// ============================================================
// TQG — shared nav + mobile menu
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.querySelector('.burger');
  const links = document.querySelector('.nav-links');
  if (!burger || !links) return;
  const close = () => { burger.setAttribute('aria-expanded', 'false'); links.classList.remove('open'); };
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    links.classList.toggle('open', !open);
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
});