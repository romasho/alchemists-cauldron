export function bindDragDrop(
  root: HTMLElement,
  canAdd: (id: string) => boolean,
  add: (id: string) => void,
): void {
  const zone = root.querySelector<HTMLElement>('.cauldron-panel');
  if (!zone) throw new Error('Missing cauldron drop zone');
  let draggedId: string | null = null;
  let dragPreview: HTMLDivElement | null = null;
  const reset = (): void => {
    draggedId = null;
    dragPreview?.remove();
    dragPreview = null;
    zone.classList.remove('drop-ready');
  };
  root.addEventListener('dragstart', (event) => {
    const card =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-add]')
        : null;
    const id = card?.dataset['add'];
    if (!id || !canAdd(id) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    draggedId = id;
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'copy';
    const image = card.querySelector<HTMLImageElement>('.ingredient-art');
    if (image) {
      dragPreview?.remove();
      const { width, height } = image.getBoundingClientRect();
      dragPreview = document.createElement('div');
      dragPreview.className = 'ingredient-drag-preview';
      dragPreview.setAttribute('aria-hidden', 'true');
      dragPreview.style.width = `${String(width)}px`;
      dragPreview.style.height = `${String(height)}px`;
      const icon = image.cloneNode() as HTMLImageElement;
      icon.removeAttribute('class');
      dragPreview.append(icon);
      document.body.append(dragPreview);
      event.dataTransfer.setDragImage(dragPreview, width / 2, height / 2);
    }
  });
  zone.addEventListener('dragover', (event) => {
    if (!draggedId || !canAdd(draggedId)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('drop-ready');
  });
  zone.addEventListener('dragleave', (event) => {
    if (
      event.relatedTarget instanceof Node &&
      zone.contains(event.relatedTarget)
    )
      return;
    zone.classList.remove('drop-ready');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    if (id && id === draggedId && canAdd(id)) add(id);
    reset();
  });
  root.addEventListener('dragend', reset);
  document.addEventListener('visibilitychange', reset);
}
