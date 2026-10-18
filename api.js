const API_URL = 'https://jsonplaceholder.typicode.com/posts';

const loadButton = document.querySelector('#load-btn');
const statusMessage = document.querySelector('#status');
const notesList = document.querySelector('#notes-list');

function setStatus(message, kind = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status status-${kind}`;
}

function renderEmptyState() {
  const item = document.createElement('li');
  item.className = 'empty-state';
  item.textContent = 'No notes yet. Load notes or create your first one.';
  notesList.replaceChildren(item);
}

function renderNotes(notes) {
  notesList.replaceChildren();
  if (notes.length === 0) {
    renderEmptyState();
    return;
  }

  for (const note of notes) {
    const item = document.createElement('li');
    item.className = 'note-card';
    const title = document.createElement('h3');
    title.textContent = note.title;
    const body = document.createElement('p');
    body.textContent = note.body;
    item.append(title, body);
    notesList.append(item);
  }
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus('Loading notes...', 'loading');
  try {
    const notes = await request(`${API_URL}?_limit=10`);
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus('The server has no notes yet.', 'info');
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
    }
  } catch (error) {
    setStatus('Sorry, notes could not be loaded. Check your connection and try again.', 'error');
    renderEmptyState();
    console.error('GET notes failed:', error);
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener('click', loadNotes);
