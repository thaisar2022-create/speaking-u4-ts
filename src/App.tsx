import React, { useState, useEffect, useRef } from 'react';
import {
  words,
  sentences,
  schoolPhonetics,
  unit4GrammarPatterns,
  qaLessons,
  rearrangeLessons,
  quizQuestions,
  blanks,
  fillVocabulary,
  WordItem,
  SentenceItem
} from './data';

type Page = 'home' | 'learn' | 'practice' | 'flash' | 'settings';
type LearnTab = 'Words' | 'Sentences' | 'Q & A' | 'Grammar';
type PracticeMode = 'quiz' | 'blank' | 'rearrange';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [learnTab, setLearnTab] = useState<LearnTab>('Words');
  const [learnIndex, setLearnIndex] = useState(0);
  const [qaIndex, setQaIndex] = useState(0);

  // Flashcards
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashBack, setFlashBack] = useState(false);

  // Practice state
  const [practice, setPractice] = useState<PracticeMode>('quiz');
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizResponses, setQuizResponses] = useState<{ index: number; choice: number; correct: boolean }[]>([]);

  // Listen & Fill state
  const [fillIndex, setFillIndex] = useState(0);
  const [fillChoice, setFillChoice] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  // Rearrange state
  const [reorderIndex, setReorderIndex] = useState(0);
  const [reorderPicked, setReorderPicked] = useState<number[]>([]);
  const [reorderChecked, setReorderChecked] = useState(false);

  // Voice & progress settings
  const [speed, setSpeed] = useState<number>(() => {
    return parseFloat(localStorage.getItem('thaiSpeed') || '0.85');
  });
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('thaiDoneUnit4V4') || '[]');
    } catch {
      return [];
    }
  });

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [detectedVoices, setDetectedVoices] = useState<string>('');

  // Audio Recording
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordedAudioURLs, setRecordedAudioURLs] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Service Worker registration
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Check available Thai voices
    const checkVoices = () => {
      if ('speechSynthesis' in window) {
        const vs = window.speechSynthesis.getVoices();
        const thVoices = vs.filter(x => x.lang.toLowerCase().startsWith('th'));
        if (thVoices.length > 0) {
          setDetectedVoices(thVoices.map(x => `${x.name} (${x.lang})`).join(', '));
        } else {
          setDetectedVoices('No Thai voice is currently detected on this device.');
        }
      }
    };

    checkVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = checkVoices;
    }
  }, []);

  const markDone = (key: string) => {
    setDone(prev => {
      if (!prev.includes(key)) {
        const next = [...prev, key];
        localStorage.setItem('thaiDoneUnit4V4', JSON.stringify(next));
        return next;
      }
      return prev;
    });
  };

  const totalActivities =
    words.length +
    sentences.length +
    qaLessons.length +
    rearrangeLessons.length +
    quizQuestions.length +
    blanks.length;
  const progressPercent = Math.min(100, Math.round((done.length / Math.max(1, totalActivities)) * 100));

  const speak = (text: string, customSpeed?: number) => {
    if (!('speechSynthesis' in window)) {
      alert('ဤဖုန်းတွင် စာသားမှ အသံဖတ်သည့်စနစ် မရရှိပါ။');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = customSpeed ?? speed;

    const voices = window.speechSynthesis.getVoices();
    const thVoice =
      voices.find(v => v.lang.toLowerCase() === 'th-th') ||
      voices.find(v => v.lang.toLowerCase().startsWith('th'));
    if (thVoice) {
      utterance.voice = thVoice;
    } else {
      setStatusMessage(
        'Thai voice not found. Your phone may use a fallback voice. For accurate Thai tones, use recorded audio in the production app.'
      );
    }
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = async (id: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingId(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Recording requires HTTPS (or localhost) and a compatible browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setRecordingId(id);

      rec.ondataavailable = e => {
        if (e.data.size) {
          audioChunksRef.current.push(e.data);
        }
      };

      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType });
        const audioUrl = URL.createObjectURL(blob);
        setRecordedAudioURLs(prev => {
          if (prev[id]) URL.revokeObjectURL(prev[id]);
          return { ...prev, [id]: audioUrl };
        });
      };

      mediaRecorderRef.current = rec;
      rec.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Microphone permission unavailable: ' + msg);
      setRecordingId(null);
    }
  };

  const navigateTo = (newPage: Page) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleLearnTabChange = (t: LearnTab) => {
    setLearnTab(t);
    setLearnIndex(0);
  };

  const stepLearn = (delta: number) => {
    const arr = learnTab === 'Words' ? words : sentences;
    markDone(`learn-${learnTab}-${learnIndex}`);
    setLearnIndex((learnIndex + delta + arr.length) % arr.length);
  };

  const stepQA = (delta: number) => {
    markDone(`learn-qa-${qaIndex}`);
    setQaIndex((qaIndex + delta + qaLessons.length) % qaLessons.length);
  };

  const nextFlash = (delta: number) => {
    setFlashIndex((flashIndex + delta + words.length) % words.length);
    setFlashBack(false);
  };

  const flipFlash = () => {
    setFlashBack(!flashBack);
    markDone(`card-${flashIndex}`);
  };

  // Practice: Quiz
  const chooseQuiz = (choiceIdx: number) => {
    const q = quizQuestions[quizIndex];
    if (quizResponses.some(x => x.index === quizIndex)) return;
    const isCorrect = choiceIdx === q.correct;
    setQuizResponses(prev => [...prev, { index: quizIndex, choice: choiceIdx, correct: isCorrect }]);
    if (isCorrect) setQuizScore(prev => prev + 1);
  };

  const nextQuiz = () => {
    const nextIdx = quizIndex + 1;
    setQuizIndex(nextIdx);
    if (nextIdx >= quizQuestions.length) {
      markDone('unit4-quiz-completed');
    }
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setQuizScore(0);
    setQuizResponses([]);
  };

  // Practice: Listen & Fill
  const currentBlank = blanks[fillIndex % blanks.length];
  const blankCorrectIdx = currentBlank.choices.indexOf(currentBlank.answer);

  const chooseFillOption = (idx: number) => {
    if (fillChecked) return;
    setFillChoice(idx);
  };

  const checkBlankAnswer = () => {
    if (fillChecked || fillChoice === null) return;
    setFillChecked(true);
    if (currentBlank.choices[fillChoice] === currentBlank.answer) {
      markDone(`blank-${fillIndex}`);
    }
  };

  const retryBlank = () => {
    setFillChoice(null);
    setFillChecked(false);
  };

  const completeBlank = () => {
    if (fillChecked && fillChoice !== null && currentBlank.choices[fillChoice] === currentBlank.answer) {
      markDone(`blank-${fillIndex}`);
    }
    setFillIndex((fillIndex + 1) % blanks.length);
    setFillChoice(null);
    setFillChecked(false);
  };

  // Practice: Rearrange
  const currentRearrange = rearrangeLessons[reorderIndex];
  const rearrangeBankOrder = () => {
    const n = currentRearrange.parts.length;
    return Array.from({ length: n }, (_, i) => n - 1 - i);
  };

  const pickRearranged = (id: number) => {
    if (reorderPicked.includes(id) || reorderPicked.length >= currentRearrange.parts.length) return;
    setReorderPicked(prev => [...prev, id]);
    setReorderChecked(false);
  };

  const removeRearranged = (id: number) => {
    setReorderPicked(prev => prev.filter(x => x !== id));
    setReorderChecked(false);
  };

  const checkRearrangedSentence = () => {
    if (reorderPicked.length !== currentRearrange.parts.length) return;
    setReorderChecked(true);
    if (reorderPicked.every((id, j) => id === j)) {
      markDone(`rearrange-${reorderIndex}`);
    }
  };

  const resetRearrangedSentence = () => {
    setReorderPicked([]);
    setReorderChecked(false);
  };

  const nextRearrangedSentence = () => {
    setReorderIndex((reorderIndex + 1) % rearrangeLessons.length);
    setReorderPicked([]);
    setReorderChecked(false);
  };

  // Render helpers
  const renderItemCard = (
    item: WordItem | SentenceItem,
    categoryLabel: string,
    recId = 'main',
    withRecord = true
  ) => {
    const phon = schoolPhonetics[item[0]] || item[1];
    return (
      <div className="card">
        <span className="tag">{categoryLabel}</span>
        <div className="thai" lang="th">
          {item[0]}
        </div>
        <div className="phonetic">{phon}</div>
        <div className="mm" lang="my">
          {item[2]}
        </div>
        <div className="controls">
          <button className="btn" onClick={() => speak(item[0])}>
            🔊 နားထောင်ပါ
          </button>
          <button className="btn secondary" onClick={() => speak(item[0], 0.7)}>
            🐢 ဖြည်းဖြည်း
          </button>
          {withRecord && (
            <button
              className={`btn ghost ${recordingId === recId ? 'recording' : ''}`}
              onClick={() => toggleRecording(recId)}
            >
              {recordingId === recId ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
            </button>
          )}
        </div>
        {withRecord && recordedAudioURLs[recId] && (
          <div style={{ marginTop: '10px' }}>
            <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
            <audio controls src={recordedAudioURLs[recId]} />
          </div>
        )}
      </div>
    );
  };

  const renderTabBar = () => (
    <div className="controls" style={{ marginBottom: '14px' }}>
      {(['Words', 'Sentences', 'Q & A', 'Grammar'] as LearnTab[]).map(tab => (
        <button
          key={tab}
          className={`btn ${learnTab === tab ? '' : 'secondary'}`}
          onClick={() => handleLearnTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <div className="app">
      {/* Hero Header */}
      <header className="hero">
        <div className="top">
          <div className="brandwrap">
            <img className="school-logo" src="/school-logo.png" alt="ThaiSar school logo" />
            <div>
              <div className="brand-title">THAISAR</div>
              <div className="logo-label">Thai · Myanmar Speaking School</div>
            </div>
          </div>
          <div className="pill">🇹🇭 + 🇲🇲</div>
        </div>
        <h1>အခန်း (၄) · ဈေးဝယ်ခြင်း</h1>
        <p>Unit 4 · Listening & Speaking · Beginner</p>
        <div className="progress">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        <div id="progressLabel" className="small" style={{ marginTop: '7px', color: '#e2f9f0' }}>
          သင်ယူမှု တိုးတက်မှု · {progressPercent}% ({done.length} activities)
        </div>
      </header>

      {/* Main Screen Content */}
      <main id="main" className="content">
        {page === 'home' && (
          <div>
            <div className="section-head">
              <h2>စတင်လေ့လာပါ 🌼</h2>
              <span className="muted">အခန်း ၄</span>
            </div>
            <div className="notice">
              အသံကို နားထောင်ပါ → လိုက်ပြောပါ → စာကြောင်းကို လေ့ကျင့်ပါ။ ထိုင်းအက္ခရာ အရင်ကျက်ရန် မလိုပါ။
            </div>
            <div className="rows" style={{ marginTop: '14px' }}>
              <button
                className="tile"
                onClick={() => {
                  navigateTo('learn');
                  setLearnTab('Words');
                  setLearnIndex(0);
                }}
              >
                <span className="emoji">📖</span>
                <strong>စကားလုံးများ</strong>
                <small>Vocabulary · {words.length} items</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigateTo('learn');
                  setLearnTab('Sentences');
                  setLearnIndex(0);
                }}
              >
                <span className="emoji">🎧</span>
                <strong>ဝါကျများ</strong>
                <small>Listen & repeat · {sentences.length}</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigateTo('learn');
                  setLearnTab('Grammar');
                }}
              >
                <span className="emoji">🧩</span>
                <strong>သဒ္ဒါ</strong>
                <small>Tap to see examples</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigateTo('learn');
                  setLearnTab('Q & A');
                  setQaIndex(0);
                }}
              >
                <span className="emoji">💬</span>
                <strong>အမေး / အဖြေ</strong>
                <small>10 learn-only dialogue pairs</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigateTo('practice');
                  setPractice('quiz');
                  resetQuiz();
                }}
              >
                <span className="emoji">📝</span>
                <strong>Unit 4 Quiz</strong>
                <small>12 comprehension questions</small>
              </button>
            </div>

            <h3 style={{ marginTop: '24px' }}>ဒီနေ့ လေ့လာမယ့် ဝါကျ</h3>
            {renderItemCard(sentences[0], 'Listen & repeat', 'home-preview', false)}

            <button className="btn wide" style={{ marginTop: '12px' }} onClick={() => navigateTo('learn')}>
              သင်ခန်းစာ စတင်ရန် →
            </button>
          </div>
        )}

        {page === 'learn' && (
          <div>
            {learnTab === 'Q & A' && (
              <div>
                <div className="section-head">
                  <h2>မေးခွန်းနှင့် အဖြေ · Q & A</h2>
                  <span className="counter">
                    {qaIndex + 1} / {qaLessons.length}
                  </span>
                </div>
                {renderTabBar()}
                <p className="section-intro">
                  ဤအမေး/အဖြေတွဲများသည် အခန်း (၄) မှ စာကြောင်းများကို ပေါင်းစပ်ထားသော လေ့ကျင့်ခန်းဖြစ်သည်။
                  တစ်ကြောင်းချင်း နားထောင်ပြီး လိုက်ပြောပါ။ ဖြေရန် မလိုပါ။
                </p>

                <div className="card">
                  {/* Question */}
                  <div className="qa-item">
                    <span className="tag">Q · မေးခွန်း</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][0]}
                    </div>
                    <div className="phonetic">{schoolPhonetics[qaLessons[qaIndex][0]] || ''}</div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][2]}
                    </div>
                    <div className="controls">
                      <button className="btn" onClick={() => speak(qaLessons[qaIndex][0])}>
                        🔊 နားထောင်ပါ
                      </button>
                      <button className="btn secondary" onClick={() => speak(qaLessons[qaIndex][0], 0.7)}>
                        🐢 ဖြည်းဖြည်း
                      </button>
                      <button
                        className={`btn ghost ${recordingId === 'qaQuestion' ? 'recording' : ''}`}
                        onClick={() => toggleRecording('qaQuestion')}
                      >
                        {recordingId === 'qaQuestion' ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
                      </button>
                    </div>
                    {recordedAudioURLs['qaQuestion'] && (
                      <div style={{ marginTop: '10px' }}>
                        <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
                        <audio controls src={recordedAudioURLs['qaQuestion']} />
                      </div>
                    )}
                  </div>

                  <div className="qa-divider">↓ Answer · အဖြေ</div>

                  {/* Answer */}
                  <div className="qa-item">
                    <span className="tag">A · အဖြေ</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][1]}
                    </div>
                    <div className="phonetic">{schoolPhonetics[qaLessons[qaIndex][1]] || ''}</div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][3]}
                    </div>
                    <div className="controls">
                      <button className="btn" onClick={() => speak(qaLessons[qaIndex][1])}>
                        🔊 နားထောင်ပါ
                      </button>
                      <button className="btn secondary" onClick={() => speak(qaLessons[qaIndex][1], 0.7)}>
                        🐢 ဖြည်းဖြည်း
                      </button>
                      <button
                        className={`btn ghost ${recordingId === 'qaAnswer' ? 'recording' : ''}`}
                        onClick={() => toggleRecording('qaAnswer')}
                      >
                        {recordingId === 'qaAnswer' ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
                      </button>
                    </div>
                    {recordedAudioURLs['qaAnswer'] && (
                      <div style={{ marginTop: '10px' }}>
                        <p className="muted">သင့်အသံကို ပြန်နားထောင်ပါ</p>
                        <audio controls src={recordedAudioURLs['qaAnswer']} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="controls">
                  <button className="btn secondary" onClick={() => stepQA(-1)}>
                    ← အရင်တစ်ခု
                  </button>
                  <button className="btn" onClick={() => stepQA(1)}>
                    နောက်တစ်ခု →
                  </button>
                </div>
                {statusMessage && <p className="footnote">{statusMessage}</p>}
              </div>
            )}

            {learnTab === 'Grammar' && (
              <div>
                <div className="section-head">
                  <h2>သဒ္ဒါ · Grammar</h2>
                  <span className="counter">{unit4GrammarPatterns.length} patterns</span>
                </div>
                {renderTabBar()}
                <p className="section-intro">
                  အခန်း (၄) စာအုပ်မှ ဝါကျများတွင် ပါဝင်သော သဒ္ဒါပုံစံများကို စုစည်းထားပါသည်။ ခေါင်းစဉ်ကို
                  နှိပ်ပြီး ထိုင်းစာ၊ အသံထွက်နှင့် မြန်မာအဓိပ္ပာယ်ကို လေ့လာပါ။
                </p>

                {unit4GrammarPatterns.map((g, j) => {
                  const patternExamples = g.examples
                    .map(t => sentences.find(s => s[0] === t) || words.find(w => w[0] === t))
                    .filter((x): x is WordItem | SentenceItem => Boolean(x));

                  return (
                    <details className="grammar-accordion" key={j} open={j === 0 ? true : undefined}>
                      <summary>
                        {j + 1}. {g.title}
                      </summary>
                      <div className="grammar-body">
                        <h3 style={{ marginTop: '15px' }}>{g.formula}</h3>
                        <p className="muted">{g.explain}</p>
                        {patternExamples.map((ex, k) => (
                          <div key={k} style={{ padding: '15px 0', borderTop: '1px solid #efe7f1' }}>
                            <div className="thai" style={{ fontSize: '23px' }} lang="th">
                              {ex[0]}
                            </div>
                            <div className="phonetic">{schoolPhonetics[ex[0]] || ex[1]}</div>
                            <div className="mm" lang="my">
                              {ex[2]}
                            </div>
                            <div className="controls">
                              <button className="btn" onClick={() => speak(ex[0])}>
                                🔊 နားထောင်ပါ
                              </button>
                              <button className="btn secondary" onClick={() => speak(ex[0], 0.7)}>
                                🐢 ဖြည်းဖြည်း
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            {(learnTab === 'Words' || learnTab === 'Sentences') && (
              <div>
                {(() => {
                  const arr = learnTab === 'Words' ? words : sentences;
                  const item = arr[learnIndex];
                  return (
                    <div>
                      <div className="section-head">
                        <h2>နားထောင်ပြီး လိုက်ပြောပါ</h2>
                        <span className="counter">
                          {learnIndex + 1} / {arr.length}
                        </span>
                      </div>
                      {renderTabBar()}
                      {renderItemCard(item, item[3], `learn-${learnTab}-${learnIndex}`)}
                      <div className="controls">
                        <button className="btn secondary" onClick={() => stepLearn(-1)}>
                          ← ရှေ့သို့
                        </button>
                        <button className="btn" onClick={() => stepLearn(1)}>
                          နောက်တစ်ခု →
                        </button>
                      </div>
                      {statusMessage && <p className="footnote">{statusMessage}</p>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {page === 'flash' && (
          <div>
            <div className="section-head">
              <h2>Flashcards · မှတ်သားလေ့ကျင့်</h2>
              <span className="counter">
                {flashIndex + 1} / {words.length}
              </span>
            </div>
            <div
              className="card"
              style={{
                textAlign: 'center',
                minHeight: '310px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              onClick={flipFlash}
            >
              <span className="tag">{flashBack ? 'Meaning' : 'Thai word'}</span>
              {flashBack ? (
                <div className="mm" style={{ fontSize: '26px' }}>
                  {words[flashIndex][2]}
                </div>
              ) : (
                <>
                  <div className="thai">{words[flashIndex][0]}</div>
                  <div className="phonetic">
                    {schoolPhonetics[words[flashIndex][0]] || words[flashIndex][1]}
                  </div>
                </>
              )}
              <p className="muted" style={{ marginTop: '16px' }}>
                ကတ်ကိုနှိပ်ပြီး လှန်ကြည့်ပါ
              </p>
            </div>
            <div className="controls">
              <button className="btn secondary" onClick={() => speak(words[flashIndex][0])}>
                🔊 နားထောင်ပါ
              </button>
              <button className="btn ghost" onClick={() => nextFlash(-1)}>
                ← ရှေ့သို့
              </button>
              <button className="btn" onClick={() => nextFlash(1)}>
                နောက်တစ်ခု →
              </button>
            </div>
          </div>
        )}

        {page === 'practice' && (
          <div>
            <div className="section-head">
              <h2>Practice · လေ့ကျင့်ခန်း</h2>
            </div>
            <div className="rows practice-tiles">
              <button className="tile" onClick={() => setPractice('quiz')}>
                📝 <strong>Unit 4 Quiz</strong>
                <small>သင်ယူထားသည်ကို စမ်းစစ်ပါ</small>
              </button>
              <button className="tile" onClick={() => setPractice('blank')}>
                🎧 <strong>Listen & Fill</strong>
                <small>နားထောင်ပြီး ဖြည့်ပါ</small>
              </button>
              <button className="tile" onClick={() => setPractice('rearrange')}>
                🧩 <strong>Rearrange Sentence</strong>
                <small>စကားလုံးများကို အစီအစဉ်မှန် စီပါ</small>
              </button>
            </div>

            {/* Sub Mode: Quiz */}
            {practice === 'quiz' && (
              <div>
                {quizIndex >= quizQuestions.length ? (
                  <div className="card quiz-finish">
                    <div className="bigscore">
                      {Math.round((quizScore / quizQuestions.length) * 100)}%
                    </div>
                    <h2>Unit 4 Quiz ပြီးပါပြီ!</h2>
                    <p className="mm">
                      {quizScore} / {quizQuestions.length} မှန်ပါတယ်။
                    </p>
                    <p className="muted">မှားခဲ့သော မေးခွန်းများကို ပြန်ကြည့်ပြီး နောက်တစ်ကြိမ် စမ်းကြည့်နိုင်ပါတယ်။</p>
                    {quizResponses
                      .filter(x => !x.correct)
                      .map((res, idx) => (
                        <div className="quiz-review" key={idx}>
                          <strong>{quizQuestions[res.index].q}</strong>
                          <p className="muted">{quizQuestions[res.index].why}</p>
                        </div>
                      ))}
                    <button className="btn wide" style={{ marginTop: '18px' }} onClick={resetQuiz}>
                      🔄 Quiz ပြန်ဖြေရန်
                    </button>
                  </div>
                ) : (
                  <div className="card">
                    <span className="tag">
                      Unit 4 Quiz · {quizIndex + 1} / {quizQuestions.length}
                    </span>
                    <div className="quiz-progress">
                      <span style={{ width: `${(100 * quizIndex) / quizQuestions.length}%` }} />
                    </div>
                    <h3 className="quiz-question">{quizQuestions[quizIndex].q}</h3>
                    {quizQuestions[quizIndex].audio && (
                      <div className="controls">
                        <button className="btn" onClick={() => speak(quizQuestions[quizIndex].audio!)}>
                          🔊 အသံနားထောင်ပါ
                        </button>
                        <button
                          className="btn secondary"
                          onClick={() => speak(quizQuestions[quizIndex].audio!, 0.7)}
                        >
                          🐢 ဖြည်းဖြည်း
                        </button>
                      </div>
                    )}
                    <div className="stack" style={{ marginTop: '17px' }}>
                      {quizQuestions[quizIndex].choices.map((opt, j) => {
                        const answered = quizResponses.find(x => x.index === quizIndex);
                        let optClass = 'quiz-option';
                        if (answered) {
                          if (j === quizQuestions[quizIndex].correct) optClass += ' correct';
                          else if (j === answered.choice) optClass += ' incorrect';
                        }
                        return (
                          <button
                            key={j}
                            className={optClass}
                            disabled={Boolean(answered)}
                            onClick={() => chooseQuiz(j)}
                          >
                            {String.fromCharCode(65 + j)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const ans = quizResponses.find(x => x.index === quizIndex);
                      if (!ans) {
                        return <p className="muted" style={{ marginTop: '14px' }}>အဖြေတစ်ခုကို ရွေးပါ။</p>;
                      }
                      return (
                        <>
                          <div className="quiz-feedback">
                            {ans.correct ? '✅ မှန်ပါတယ်!' : '❌ လေ့လာပြီး ထပ်စမ်းကြည့်ပါ။'}
                            <p>{quizQuestions[quizIndex].why}</p>
                          </div>
                          <button className="btn wide" onClick={nextQuiz}>
                            {quizIndex === quizQuestions.length - 1 ? 'ရလဒ် ကြည့်ရန် →' : 'နောက်မေးခွန်း →'}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Sub Mode: Listen & Fill */}
            {practice === 'blank' && (
              <div className="card fill-card">
                <span className="tag">
                  🎧 Listen & Fill · {(fillIndex % blanks.length) + 1} / {blanks.length}
                </span>
                <p className="section-intro">
                  အသံကို နားထောင်ပြီး အဖြေမှန်ကို ရွေးပါ။ <strong>ထိုင်းစာဖတ်တတ်ရန် မလိုပါ။</strong>{' '}
                  ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic၊ မြန်မာအသံထွက်နှင့် မြန်မာအဓိပ္ပာယ် ပါရှိသည်။
                </p>

                <div className="fill-prompt">
                  <span className="fill-prompt-label">မြန်မာအဓိပ္ပာယ်</span>
                  <div className="mm" lang="my">
                    {currentBlank.meaning}
                  </div>
                  <div className="fill-blank-line" lang="th">
                    {currentBlank.blank}
                  </div>
                </div>

                <div className="controls">
                  <button className="btn" onClick={() => speak(currentBlank.full)}>
                    🔊 နားထောင်ပါ
                  </button>
                  <button className="btn secondary" onClick={() => speak(currentBlank.full, 0.7)}>
                    🐢 ဖြည်းဖြည်း
                  </button>
                </div>

                <h3 className="fill-heading">အဖြေတစ်ခုကို ရွေးပါ။</h3>
                <div className="fill-options" role="group" aria-label="Listen and Fill choices">
                  {currentBlank.choices.map((word, j) => {
                    const entry = fillVocabulary[word] || ['-', '-', '-'];
                    let stateClass = '';
                    if (fillChecked) {
                      if (j === blankCorrectIdx) stateClass = ' is-correct';
                      else if (j === fillChoice) stateClass = ' is-wrong';
                    } else if (fillChoice === j) {
                      stateClass = ' is-selected';
                    }

                    return (
                      <button
                        type="button"
                        key={j}
                        className={`fill-choice${stateClass}`}
                        disabled={fillChecked}
                        onClick={() => chooseFillOption(j)}
                        aria-pressed={fillChoice === j}
                      >
                        <span className="fill-number">{String.fromCharCode(65 + j)}</span>
                        <span className="fill-lines">
                          <span className="fill-thai" lang="th">
                            {word}
                          </span>
                          <span className="fill-phonetic">{entry[0]}</span>
                          <span className="fill-pronunciation" lang="my">
                            {entry[1]}
                          </span>
                          <span className="fill-meaning" lang="my">
                            {entry[2]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!fillChecked ? (
                  <button
                    className="btn wide"
                    disabled={fillChoice === null}
                    onClick={checkBlankAnswer}
                  >
                    အဖြေစစ်ဆေးပါ
                  </button>
                ) : (
                  <div>
                    <div
                      className={`fill-feedback ${fillChoice === blankCorrectIdx ? 'good' : 'retry'}`}
                      role="status"
                    >
                      <strong>
                        {fillChoice === blankCorrectIdx ? '✅ မှန်ပါတယ်!' : '📖 အဖြေမှန်ကို လေ့လာပါ။'}
                      </strong>
                      <p>
                        {fillChoice === blankCorrectIdx
                          ? 'အသံကို မှန်ကန်စွာ ရွေးချယ်နိုင်ပါတယ်။'
                          : 'မှားသောအဖြေကို ပြထားပြီး အဖြေမှန်ကို အစိမ်းရောင်ဖြင့် ပြထားပါတယ်။'}
                      </p>
                      <div className="fill-fully">
                        <div className="thai" lang="th">
                          {currentBlank.full}
                        </div>
                        <div className="phonetic">
                          {schoolPhonetics[currentBlank.full] || ''}
                        </div>
                        <div className="mm" lang="my">
                          {currentBlank.meaning}
                        </div>
                      </div>
                    </div>
                    <div className="controls">
                      <button className="btn secondary" onClick={retryBlank}>
                        ↺ ပြန်လေ့ကျင့်ရန်
                      </button>
                      <button className="btn" onClick={completeBlank}>
                        {fillIndex === blanks.length - 1 ? 'အစက ပြန်လေ့ကျင့်ရန်' : 'နောက်မေးခွန်း →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sub Mode: Rearrange */}
            {practice === 'rearrange' && (
              <div className="card">
                <span className="tag">
                  Rearrange Sentence · {reorderIndex + 1} / {rearrangeLessons.length}
                </span>
                <p className="section-intro">
                  မြန်မာအဓိပ္ပာယ်ကို ဖတ်ပြီး ထိုင်းစကားလုံးများကို အစီအစဉ်မှန် စီပါ။ ကတ်တစ်ခုစီတွင်
                  ထိုင်းစာ၊ စာအုပ်သုံး phonetic နှင့် မြန်မာအသံထွက် ပါရှိသည်။
                </p>

                <div className="reorder-prompt">
                  <strong>မြန်မာအဓိပ္ပာယ်</strong>
                  <div className="mm">{currentRearrange.meaning}</div>
                </div>

                <div className="controls">
                  <button
                    className="btn secondary"
                    onClick={() => speak(currentRearrange.parts.map(p => p[0]).join(''))}
                  >
                    🔊 နားထောင်ပါ
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => speak(currentRearrange.parts.map(p => p[0]).join(''), 0.7)}
                  >
                    🐢 အနှေးအသံ
                  </button>
                </div>

                <div className="reorder-area">
                  <h4>၁။ စီထားသော စကားလုံးများ (နှိပ်၍ ပြန်ဖြုတ်နိုင်ပါသည်)</h4>
                  <div className="reorder-tiles">
                    {reorderPicked.length === 0 ? (
                      <div className="reorder-empty">အောက်က ကတ်များကို အစဉ်လိုက် နှိပ်ပါ။</div>
                    ) : (
                      reorderPicked.map(partId => {
                        const part = currentRearrange.parts[partId];
                        return (
                          <button
                            type="button"
                            key={partId}
                            className="reorder-token selected"
                            onClick={() => removeRearranged(partId)}
                          >
                            <span className="reorder-thai" lang="th">
                              {part[0]}
                            </span>
                            <span className="reorder-phon">{part[1]}</span>
                            <span className="reorder-my" lang="my">
                              {part[2]}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="reorder-bank">
                  <h4>၂။ စကားလုံးကတ်များ</h4>
                  <div className="reorder-tiles">
                    {(() => {
                      const availableIds = rearrangeBankOrder().filter(id => !reorderPicked.includes(id));
                      if (availableIds.length === 0) {
                        return <span className="muted">စကားလုံးအားလုံး စီပြီးပါပြီ။</span>;
                      }
                      return availableIds.map(partId => {
                        const part = currentRearrange.parts[partId];
                        return (
                          <button
                            type="button"
                            key={partId}
                            className="reorder-token"
                            onClick={() => pickRearranged(partId)}
                          >
                            <span className="reorder-thai" lang="th">
                              {part[0]}
                            </span>
                            <span className="reorder-phon">{part[1]}</span>
                            <span className="reorder-my" lang="my">
                              {part[2]}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {reorderChecked && (
                  <div>
                    {reorderPicked.every((id, j) => id === j) ? (
                      <>
                        <div className="reorder-status good" role="status">
                          <strong>✅ မှန်ပါတယ်!</strong> စာကြောင်းကို မှန်ကန်စွာ စီထားပါတယ်။
                        </div>
                        <div className="reorder-complete">
                          <div className="thai" lang="th">
                            {currentRearrange.parts.map(p => p[0]).join('')}
                          </div>
                          <div className="phonetic">
                            {`/${currentRearrange.parts
                              .map(p => p[1].replaceAll('/', ''))
                              .join('-')}/`}
                          </div>
                          <div className="mm">{currentRearrange.meaning}</div>
                        </div>
                      </>
                    ) : (
                      <div className="reorder-status try" role="status">
                        အစီအစဉ် မမှန်သေးပါ။ စကားလုံးကို နှိပ်ပြီး ပြန်ရွှေ့နိုင်ပါတယ်။
                      </div>
                    )}
                  </div>
                )}

                <div className="reorder-controls">
                  <button className="btn secondary" onClick={resetRearrangedSentence}>
                    ↺ ပြန်စီရန်
                  </button>
                  {reorderChecked && reorderPicked.every((id, j) => id === j) ? (
                    <button className="btn" onClick={nextRearrangedSentence}>
                      {reorderIndex === rearrangeLessons.length - 1
                        ? 'နောက်တစ်ကြိမ် လေ့ကျင့်ရန်'
                        : 'နောက်ဝါကျ →'}
                    </button>
                  ) : (
                    <button
                      className="btn"
                      disabled={reorderPicked.length !== currentRearrange.parts.length}
                      onClick={checkRearrangedSentence}
                    >
                      ✓ အဖြေစစ်ရန်
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {page === 'settings' && (
          <div>
            <h2>⚙️ အသံနှင့် app settings</h2>
            <div className="card">
              <h3>Thai voice · အသံ</h3>
              <p className="muted">Thai voice selection depends on the browser and operating system.</p>
              <div className="notice" style={{ marginTop: '10px' }}>
                {detectedVoices || 'Checking voice synthesis status...'}
              </div>
              <div style={{ marginTop: '16px' }}>
                <label htmlFor="rate" style={{ display: 'block', marginBottom: '6px' }}>
                  Audio speed · <span id="speedLabel">{speed}</span>×
                </label>
                <input
                  id="rate"
                  type="range"
                  min="0.5"
                  max="1.1"
                  step="0.05"
                  value={speed}
                  style={{ width: '100%' }}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setSpeed(val);
                    localStorage.setItem('thaiSpeed', String(val));
                  }}
                />
              </div>
              <div className="controls" style={{ marginTop: '14px' }}>
                <button className="btn" onClick={() => speak('สวัสดีครับ')}>
                  🔊 Thai အသံ စမ်းနားထောင်ရန်
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Install on phone</h3>
              <p className="muted">
                Open the hosted site in Chrome on Android or Safari on iPhone, then use Add to Home Screen /
                Install App.
              </p>
              <p className="small" style={{ marginTop: '8px', color: '#666' }}>
                A PWA needs HTTPS or localhost. The current preview can be installed or added to the home
                screen for fast mobile access.
              </p>
            </div>

            <div className="card">
              <h3>Student progress</h3>
              <p className="muted">Saved on this device, not synchronized with a school account.</p>
              <button
                className="btn secondary"
                style={{ marginTop: '12px' }}
                onClick={() => {
                  if (confirm('Reset your progress?')) {
                    setDone([]);
                    localStorage.removeItem('thaiDoneUnit4V4');
                  }
                }}
              >
                Reset progress
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <nav className="nav" id="nav">
        <button
          className={page === 'home' ? 'active' : ''}
          onClick={() => navigateTo('home')}
        >
          <span className="ico">⌂</span>
          ပင်မ
        </button>
        <button
          className={page === 'learn' ? 'active' : ''}
          onClick={() => navigateTo('learn')}
        >
          <span className="ico">◉</span>
          လေ့လာ
        </button>
        <button
          className={page === 'practice' ? 'active' : ''}
          onClick={() => navigateTo('practice')}
        >
          <span className="ico">✦</span>
          လေ့ကျင့်
        </button>
        <button
          className={page === 'flash' ? 'active' : ''}
          onClick={() => navigateTo('flash')}
        >
          <span className="ico">▣</span>
          ကတ်များ
        </button>
        <button
          className={page === 'settings' ? 'active' : ''}
          onClick={() => navigateTo('settings')}
        >
          <span className="ico">⚙</span>
          ချိန်ညှိ
        </button>
      </nav>
    </div>
  );
}
