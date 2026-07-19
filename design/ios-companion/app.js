const storageKey = 'wic-ios-notes-v1';
const notesElement = document.querySelector('#notes');

function readNotes() {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); }
  catch { return []; }
}

function renderNotes(notes) {
  notesElement.replaceChildren(...notes.map((record) => {
    const element = document.createElement('div');
    element.className = 'note';
    element.textContent = `${record.elementId}: ${record.note}`;
    return element;
  }));
}

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = event.target.closest('[data-element-id]');
  const note = window.prompt('Note for this position');
  if (!note) return;
  const record = {
    screenId: document.body.dataset.screenId,
    route: location.pathname,
    elementId: target?.dataset.elementId ?? 'screen',
    x: event.pageX / document.documentElement.scrollWidth,
    y: event.pageY / document.documentElement.scrollHeight,
    note,
    createdAt: new Date().toISOString(),
  };
  const notes = readNotes();
  notes.push(record);
  localStorage.setItem(storageKey, JSON.stringify(notes));
  renderNotes(notes);
});

renderNotes(readNotes());
