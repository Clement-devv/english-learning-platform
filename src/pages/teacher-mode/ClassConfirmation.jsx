import { useEffect, useId, useRef, useState } from 'react';

export function useClassConfirmation() {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.(null), []);
  function ask(options) {
    return new Promise(resolve => {
      pending.current?.(null);
      pending.current = resolve;
      setRequest(options);
    });
  }
  function finish(value) {
    pending.current?.(value);
    pending.current = null;
    setRequest(null);
  }
  return { ask, dialog: request && <ClassConfirmation {...request} finish={finish} /> };
}

function ClassConfirmation({ title, message, action, reason, finish }) {
  const ref = useRef(null);
  const id = useId();
  const [note, setNote] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="tm-confirm-dialog" aria-labelledby={id}
    onCancel={event => { event.preventDefault(); finish(null); }}>
    <form onSubmit={event => { event.preventDefault(); finish(reason ? note.trim() : true); }}>
      <h2 id={id}>{title}</h2><p>{message}</p>
      {reason && <label>Class record note<textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>}
      <div className="tm-actions"><button type="button" autoFocus onClick={() => finish(null)}>Go back</button>
        <button className="tm-primary" type="submit">{action}</button></div>
    </form>
  </dialog>;
}
