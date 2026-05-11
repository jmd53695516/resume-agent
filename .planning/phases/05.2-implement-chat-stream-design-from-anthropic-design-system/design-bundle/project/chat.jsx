// chat.jsx — auto-playing scripted chat between a recruiter and Joe's PM agent.
// Original messaging-app aesthetic (right-aligned blue, left-aligned grey),
// not a recreation of any specific app's UI.

const SCRIPT = [
  { from: 'them', text: "Hi! Saw your profile — are you Joe Dollinger's hiring agent?", t: '10:42 AM' },
  { from: 'me',   text: "I am. Joe's a Senior Product Manager — happy to help you screen the fit. What's the role?" },
  { from: 'them', text: "Senior PM for a payments platform team. ~50 engineers, IC track. Is Joe open to new roles right now?" },
  { from: 'me',   text: "He's selectively looking. Payments is in his wheelhouse — he led the wallet & instant-payouts surface at his last company for ~3 years." },
  { from: 'them', text: "Nice. How many years total in product?", t: '10:44 AM' },
  { from: 'me',   text: "Eight, all in B2C and prosumer fintech. Two as Senior PM, three as PM, three as APM." },
  { from: 'them', text: "What's a project he's most proud of?" },
  { from: 'me',   text: "Rebuilding the dispute-resolution flow. Cut median resolution time from 9 days to under 48 hours and chargebacks dropped 22% YoY." },
  { from: 'them', text: "Strong. Comp expectations?", t: '10:47 AM' },
  { from: 'me',   text: "Targeting $230–260k base + meaningful equity. Open to a conversation if the scope is right." },
  { from: 'them', text: "Got it. Remote, hybrid, or onsite?" },
  { from: 'me',   text: "Remote-first, but he's in SF and happy to be in-office 1–2 days a week for the right team." },
  { from: 'them', text: "Perfect. Can I grab 30 min with him next week?", t: '10:49 AM' },
  { from: 'me',   text: "Yes — I'll send you his Calendly. Anything specific you want him to prep?" },
  { from: 'them', text: "Just a quick walkthrough of the dispute project. Thanks!" },
  { from: 'me',   text: "Done. Calendly + a one-pager on the project are in your inbox. Talk soon 👋" },
];

// Tunables for the auto-play feel.
const PLAY = {
  readDelay: 700,        // pause after a message lands before the other party "starts typing"
  perCharType: 22,       // ms per character of upcoming message — drives typing-indicator duration
  minType: 700,
  maxType: 2400,
  postSendPause: 400,    // pause after sending before next loop
};

function useAutoPlay(script, replayKey) {
  const [shown, setShown] = React.useState([]); // array of {from, text, t}
  const [typing, setTyping] = React.useState(null); // 'me' | 'them' | null
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    setShown([]);
    setTyping(null);
    setDone(false);
    let cancelled = false;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      // small lead-in so the empty state reads for a beat
      await wait(500);
      for (let i = 0; i < script.length; i++) {
        if (cancelled) return;
        const msg = script[i];
        const typeMs = Math.max(
          PLAY.minType,
          Math.min(PLAY.maxType, msg.text.length * PLAY.perCharType)
        );
        setTyping(msg.from);
        await wait(typeMs);
        if (cancelled) return;
        setTyping(null);
        setShown((s) => [...s, msg]);
        await wait(PLAY.postSendPause);
        // a slightly longer beat between exchanges so the eye can rest
        if (i < script.length - 1 && script[i + 1].from !== msg.from) {
          await wait(PLAY.readDelay);
        }
      }
      if (!cancelled) setDone(true);
    })();

    return () => { cancelled = true; };
  }, [replayKey]);

  return { shown, typing, done };
}

// Group consecutive same-sender messages so we can round corners like a real
// messaging app (only the last bubble in a run gets the "tail" corner).
function groupMessages(list) {
  const groups = [];
  list.forEach((m, i) => {
    const prev = list[i - 1];
    if (prev && prev.from === m.from) {
      groups[groups.length - 1].push({ ...m, idx: i });
    } else {
      groups.push([{ ...m, idx: i }]);
    }
  });
  return groups;
}

function Bubble({ msg, position, from }) {
  // position: 'only' | 'first' | 'middle' | 'last'
  const isMe = from === 'me';
  const tail = position === 'only' || position === 'last';
  const radius = {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  };
  if (isMe) {
    if (position === 'first' || position === 'middle') radius.borderBottomRightRadius = 6;
    if (position === 'middle' || position === 'last') radius.borderTopRightRadius = 6;
  } else {
    if (position === 'first' || position === 'middle') radius.borderBottomLeftRadius = 6;
    if (position === 'middle' || position === 'last') radius.borderTopLeftRadius = 6;
  }
  return (
    <div className={`bubble-row ${isMe ? 'me' : 'them'}`}>
      <div className={`bubble ${isMe ? 'bubble-me' : 'bubble-them'} ${tail ? 'has-tail' : ''}`}
           style={radius}>
        {msg.text}
      </div>
    </div>
  );
}

function TypingDots({ from }) {
  const isMe = from === 'me';
  return (
    <div className={`bubble-row ${isMe ? 'me' : 'them'}`}>
      <div className={`bubble typing ${isMe ? 'bubble-me' : 'bubble-them'}`}>
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

function Timestamp({ label }) {
  return <div className="timestamp">{label}</div>;
}

function Header({ onReplay, dark }) {
  return (
    <div className="chat-header">
      <div className="header-left">
        <button className="back-btn" aria-label="Back" tabIndex={-1}>
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none">
            <path d="M9.5 1.5L2 9l7.5 7.5" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="header-center">
        <div className="avatar">
          <span>JD</span>
        </div>
        <div className="contact-name">
          Joe's Agent
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="chev">
            <path d="M1.5 1.5L6 6l-4.5 4.5" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="header-right">
        <button className="replay-btn" onClick={onReplay} title="Replay demo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2.5 8a5.5 5.5 0 1 0 1.7-3.97" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" />
            <path d="M2 1.5V5h3.5" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div className="composer">
      <button className="plus-btn" tabIndex={-1} aria-label="Attach">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" />
        </svg>
      </button>
      <div className="input-shell">
        <span className="placeholder">iMessage</span>
        <button className="mic-btn" tabIndex={-1} aria-label="Dictate">
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
            <rect x="4.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 8.5a5 5 0 0 0 10 0M7 13.5V17M4 17h6" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Chat({ dark, onReplay }) {
  const { shown, typing } = useAutoPlay(SCRIPT, 0);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, typing]);

  // Build the rendered timeline with grouping + timestamps.
  const groups = groupMessages(shown);
  const items = [];
  let lastTimestamp = null;
  groups.forEach((group, gi) => {
    // Insert any timestamps that appear at the start of this group.
    const firstWithT = group.find((m) => m.t);
    if (firstWithT && firstWithT.t !== lastTimestamp) {
      items.push(<Timestamp key={`ts-${firstWithT.idx}`} label={firstWithT.t} />);
      lastTimestamp = firstWithT.t;
    }
    group.forEach((m, mi) => {
      const position = group.length === 1 ? 'only'
        : mi === 0 ? 'first'
        : mi === group.length - 1 ? 'last' : 'middle';
      items.push(<Bubble key={`m-${m.idx}`} msg={m} position={position} from={m.from} />);
    });
  });

  return (
    <div className={`phone-shell ${dark ? 'dark' : 'light'}`}>
      <Header onReplay={onReplay} dark={dark} />
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {items}
          {typing && <TypingDots from={typing} />}
        </div>
      </div>
      <Composer />
    </div>
  );
}

window.Chat = Chat;
