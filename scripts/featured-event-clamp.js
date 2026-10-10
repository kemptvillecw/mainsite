(function () {
  function ensureDialog() {
    let dialog = document.querySelector('[data-featured-event-dialog]');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.className = 'featured-event-dialog';
    dialog.dataset.featuredEventDialog = '';
    dialog.innerHTML = `
      <div class="featured-event-dialog-inner">
        <h2 data-featured-event-dialog-title>Event details</h2>
        <div class="featured-event-dialog-description" data-featured-event-dialog-description></div>
        <div class="featured-event-dialog-actions">
          <button type="button" class="button" data-featured-event-dialog-close>Close</button>
        </div>
      </div>`;

    dialog.querySelector('[data-featured-event-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function applyClamp(target) {
    const description = target.querySelector('.featured-event-description');
    const title = target.querySelector('#featured-heading');
    if (!description || !title || description.hidden) return;

    const existingLink = target.querySelector('.featured-event-details-link');
    description.classList.remove('is-overflowing');

    requestAnimationFrame(() => {
      const overflowing = description.scrollHeight > description.clientHeight + 1;
      if (!overflowing) {
        existingLink?.remove();
        return;
      }

      description.classList.add('is-overflowing');
      if (existingLink) return;

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'featured-event-details-link';
      link.textContent = 'Event details →';
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', () => {
        const dialog = ensureDialog();
        dialog.querySelector('[data-featured-event-dialog-title]').textContent = title.textContent.trim() || 'Event details';
        dialog.querySelector('[data-featured-event-dialog-description]').textContent = description.textContent.trim();
        dialog.showModal();
      });

      description.insertAdjacentElement('afterend', link);
    });
  }

  function init() {
    const target = document.querySelector('[data-featured-event]');
    if (!target) return;

    let resizeTimer;
    const refresh = () => applyClamp(target);

    const observer = new MutationObserver(refresh);
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refresh, 120);
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
