const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Deliberate eased scrolling for the hero cue and both logo links
let activeScrollAnimation;
function smoothScrollTo(target, hash) {
  cancelAnimationFrame(activeScrollAnimation);
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  const offset = hash === '#top' ? 0 : parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  const destination = hash === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - offset;
  const start = window.scrollY;
  const distance = destination - start;
  const duration = Math.min(1200, Math.max(700, Math.abs(distance) * .45));
  const startTime = performance.now();
  const easeInOutCubic = value => value < .5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) {
      activeScrollAnimation = requestAnimationFrame(frame);
    } else {
      root.style.scrollBehavior = previousScrollBehavior;
    }
  }
  activeScrollAnimation = requestAnimationFrame(frame);
}

$$('a[href="#top"], a.hero-text-link[href="#booking"]').forEach(link => {
  link.addEventListener('click', event => {
    const target = $(link.hash);
    if (!target) return;
    event.preventDefault();
    smoothScrollTo(target, link.hash);
    try { history.pushState(null, '', link.hash); } catch { /* Scrolling also works in restricted preview frames. */ }
  });
});

$('#year').textContent = new Date().getFullYear();

// Header and mobile navigation
const header = $('.site-header');
const menuToggle = $('#menuToggle');
const mobileNav = $('#mobileNav');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 36 || menuToggle.getAttribute('aria-expanded') === 'true');
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Открыть меню');
  mobileNav.hidden = true;
  document.body.classList.remove('menu-open');
  updateHeader();
}
menuToggle.addEventListener('click', () => {
  const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(willOpen));
  menuToggle.setAttribute('aria-label', willOpen ? 'Закрыть меню' : 'Открыть меню');
  mobileNav.hidden = !willOpen;
  document.body.classList.toggle('menu-open', willOpen);
  updateHeader();
  if (willOpen) $('a', mobileNav).focus();
});
$$('a', mobileNav).forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) {
    closeMenu();
    menuToggle.focus();
  }
});
window.addEventListener('resize', () => { if (window.innerWidth > 1100 && !mobileNav.hidden) closeMenu(); });

// Full-screen photographic slider
const slides = $$('.hero-slide');
const bars = $$('#sliderBars button');
const captions = ['Ваш дом на время отдыха', 'Беседка для долгих разговоров', 'Купель под открытым небом'];
let slideIndex = 0;
let sliderPaused = reducedMotion.matches;
let sliderTimer;
function restartProgress(bar) {
  bar.classList.remove('active');
  void bar.offsetWidth;
  bar.classList.add('active');
  bar.classList.toggle('paused', sliderPaused);
}
function showSlide(index, userInitiated = false) {
  slideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle('active', i === slideIndex));
  bars.forEach((bar, i) => {
    bar.classList.remove('active', 'paused');
    bar.setAttribute('aria-current', i === slideIndex ? 'true' : 'false');
  });
  restartProgress(bars[slideIndex]);
  $('#slideNumber').textContent = String(slideIndex + 1).padStart(2, '0');
  $('#slideCaption').textContent = captions[slideIndex];
  clearTimeout(sliderTimer);
  if (!sliderPaused) sliderTimer = setTimeout(() => showSlide(slideIndex + 1), 6000);
  if (userInitiated) bars[slideIndex].focus();
}
bars.forEach((bar, i) => bar.addEventListener('click', () => showSlide(i, true)));
const pauseButton = $('#sliderPause');
function updatePauseButton() {
  pauseButton.setAttribute('aria-label', sliderPaused ? 'Запустить слайд-шоу' : 'Приостановить слайд-шоу');
  $('use', pauseButton).setAttribute('href', sliderPaused ? '#i-play' : '#i-pause');
}
pauseButton.addEventListener('click', () => {
  sliderPaused = !sliderPaused;
  updatePauseButton();
  showSlide(slideIndex);
});
document.addEventListener('visibilitychange', () => {
  clearTimeout(sliderTimer);
  if (!document.hidden && !sliderPaused) showSlide(slideIndex);
});
reducedMotion.addEventListener('change', event => {
  sliderPaused = event.matches;
  updatePauseButton();
  showSlide(slideIndex);
});
updatePauseButton();
showSlide(0);

// Booking request: validation and a real prefilled WhatsApp handoff
const bookingForm = $('#bookingForm');
const checkin = $('#checkin');
const checkout = $('#checkout');
const bookingModal = $('#bookingModal');
const adults = $('#adults');
const children = $('#children');
const childrenAges = $('#childrenAges');
const childrenAgesFields = $('#childrenAgesFields');
const guestError = $('#guestError');
childrenAgesFields.setAttribute('aria-live', 'polite');
children.setAttribute('aria-describedby', 'guestError');

const plural = (number, forms) => {
  const mod100 = number % 100;
  const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
};
const formatAge = age => Number(age) === 0 ? 'до 1 года' : `${age} ${plural(Number(age), ['год', 'года', 'лет'])}`;

function validateGuestTotal() {
  const total = Number(adults.value) + Number(children.value);
  const message = total > 8 ? 'В доме можно разместить не более 8 гостей, включая детей.' : '';
  guestError.textContent = message;
  children.setCustomValidity(message);
  return !message;
}
function renderChildrenAges() {
  const count = Number(children.value);
  const previousAges = $$('.child-age select', childrenAgesFields).map(select => select.value);
  childrenAgesFields.replaceChildren();
  childrenAges.hidden = count === 0;
  for (let i = 0; i < count; i += 1) {
    const label = document.createElement('label');
    label.className = 'child-age';
    const title = document.createElement('span');
    title.textContent = `Ребёнок ${i + 1}`;
    const select = document.createElement('select');
    select.name = `childAge${i + 1}`;
    select.required = true;
    select.setAttribute('aria-label', `Возраст ребёнка ${i + 1}`);
    select.innerHTML = '<option value="" selected disabled>Возраст</option>' + Array.from({ length: 18 }, (_, age) => `<option value="${age}">${age === 0 ? 'до 1 года' : `${age} ${plural(age, ['год', 'года', 'лет'])}`}</option>`).join('');
    if (previousAges[i] !== undefined && previousAges[i] !== '') select.value = previousAges[i];
    label.append(title, select);
    childrenAgesFields.append(label);
  }
  validateGuestTotal();
}
children.addEventListener('change', renderChildrenAges);
adults.addEventListener('change', validateGuestTotal);

const toLocalISO = date => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
checkin.min = toLocalISO(today);
checkout.min = toLocalISO(tomorrow);
checkin.addEventListener('change', () => {
  checkin.setCustomValidity('');
  checkout.setCustomValidity('');
  if (!checkin.value) return;
  const nextDay = new Date(`${checkin.value}T12:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  checkout.min = toLocalISO(nextDay);
  if (checkout.value && checkout.value <= checkin.value) checkout.value = checkout.min;
});
checkout.addEventListener('change', () => checkout.setCustomValidity(''));

// Russian validation messages for every booking field, including native browser rules
function getRussianValidationMessage(field) {
  if (field.validity.customError) return field.validationMessage;
  if (field.validity.valueMissing) {
    if (field === checkin) return 'Выберите дату заезда.';
    if (field === checkout) return 'Выберите дату отъезда.';
    if (field.matches('.child-age select')) return `Укажите возраст: ${field.previousElementSibling.textContent.toLowerCase()}.`;
    return 'Заполните это поле.';
  }
  if (field.validity.badInput) return 'Введите корректную дату.';
  if (field.validity.rangeUnderflow) {
    if (field === checkin) return 'Дата заезда не может быть в прошлом.';
    if (field === checkout) {
      if (field.value < toLocalISO(today)) return 'Дата отъезда не может быть в прошлом.';
      if (checkin.value && field.value <= checkin.value) return 'Дата отъезда должна быть позже даты заезда.';
      return 'Дата отъезда не может быть в прошлом.';
    }
  }
  if (field.validity.rangeOverflow) return 'Выбранное значение больше допустимого.';
  return '';
}
bookingForm.addEventListener('invalid', event => {
  const field = event.target;
  const message = getRussianValidationMessage(field);
  if (message && field.validationMessage !== message) field.setCustomValidity(message);
}, true);
bookingForm.addEventListener('change', event => {
  if (event.target.matches('.child-age select')) event.target.setCustomValidity('');
});

bookingForm.addEventListener('submit', event => {
  event.preventDefault();
  if (checkout.value <= checkin.value) {
    checkout.setCustomValidity('Дата отъезда должна быть позже даты заезда.');
    checkout.reportValidity();
    return;
  }
  if (!validateGuestTotal()) {
    children.reportValidity();
    return;
  }
  if (!bookingForm.reportValidity()) return;
  const formatDate = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  const adultsCount = Number(adults.value);
  const childrenCount = Number(children.value);
  const ages = $$('.child-age select', childrenAgesFields).map(select => formatAge(select.value));
  const adultsText = `${adultsCount} ${plural(adultsCount, ['взрослый', 'взрослых', 'взрослых'])}`;
  const childrenText = childrenCount ? `${childrenCount} ${plural(childrenCount, ['ребёнок', 'ребёнка', 'детей'])}` : 'без детей';
  const guestSummary = `${adultsText}, ${childrenText}${ages.length ? ` (${ages.join(', ')})` : ''}`;
  const datesSummary = `${formatDate(checkin.value)} — ${formatDate(checkout.value)}`;
  $('#modalSummary').textContent = `${datesSummary}\n${guestSummary}`;
  const ageLine = ages.length ? `\nВозраст детей: ${ages.join(', ')}` : '';
  const message = `Здравствуйте! Хочу уточнить доступность дома «Отдых в квадрате».\nЗаезд: ${formatDate(checkin.value)}\nОтъезд: ${formatDate(checkout.value)}\nГости: ${adultsText}, ${childrenText}${ageLine}\n\nПодскажите, пожалуйста, свободны ли эти даты и какая будет стоимость?`;
  $('#whatsappLink').href = `https://wa.me/375295485248?text=${encodeURIComponent(message)}`;
  bookingModal.showModal();
});
$('.modal-close').addEventListener('click', () => bookingModal.close());
bookingModal.addEventListener('click', event => {
  if (event.target === bookingModal) {
    const rect = bookingModal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) bookingModal.close();
  }
});

// Gallery lightbox
const galleryData = [
  { src: './assets/house-summer.webp', alt: 'Летний фасад гостевого дома с гирляндами', caption: 'Дом · летний фасад и входная терраса' },
  { src: './assets/living-sofa.webp', alt: 'Светлая гостиная с диваном и лестницей', caption: 'Гостиная · общее пространство для отдыха' },
  { src: './assets/bedroom.webp', alt: 'Спальня с большой кроватью и светлым текстилем', caption: 'Спальня · спокойный светлый интерьер' },
  { src: './assets/kitchen.webp', alt: 'Светлая кухня с техникой и обеденным столом', caption: 'Кухня · техника, посуда и обеденная зона' },
  { src: './assets/bathroom.webp', alt: 'Ванная комната с зеркалом с подсветкой', caption: 'Ванная · зеркало с подсветкой и современная сантехника' },
  { src: './assets/sauna.webp', alt: 'Деревянная баня-бочка на зелёной территории', caption: 'Баня-бочка · 150 BYN без ограничения по времени' },
  { src: './assets/hot-tub.webp', alt: 'Подогреваемая купель рядом с гостевым домом', caption: 'Купель · 150 BYN без ограничения по времени' },
  { src: './assets/exterior-fire.webp', alt: 'Летняя территория с шезлонгом и костровой чашей', caption: 'Территория · летний отдых и костровая зона' }
];
const lightbox = $('#lightbox');
let galleryIndex = 0;
function renderLightbox(index) {
  galleryIndex = (index + galleryData.length) % galleryData.length;
  const item = galleryData[galleryIndex];
  $('#lightboxImage').src = item.src;
  $('#lightboxImage').alt = item.alt;
  $('#lightboxCaption').textContent = `${String(galleryIndex + 1).padStart(2, '0')} / 08 · ${item.caption}`;
}
$$('[data-gallery]').forEach(button => button.addEventListener('click', () => {
  renderLightbox(Number(button.dataset.gallery));
  lightbox.showModal();
}));
$('.lightbox-close').addEventListener('click', () => lightbox.close());
$('.lightbox-prev').addEventListener('click', () => renderLightbox(galleryIndex - 1));
$('.lightbox-next').addEventListener('click', () => renderLightbox(galleryIndex + 1));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') renderLightbox(galleryIndex - 1);
  if (event.key === 'ArrowRight') renderLightbox(galleryIndex + 1);
});
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });

// Restrained scroll-linked depth on the landscape photograph
const wideStory = $('.wide-story');
const wideImage = $('.wide-story > img');
let ticking = false;
function updateParallax() {
  ticking = false;
  if (reducedMotion.matches) return;
  const rect = wideStory.getBoundingClientRect();
  if (rect.bottom > 0 && rect.top < window.innerHeight) {
    const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
    const offset = (progress - .5) * rect.height * .12;
    wideImage.style.transform = `translate3d(0, ${offset}px, 0)`;
  }
}
window.addEventListener('scroll', () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(updateParallax);
  }
}, { passive: true });
updateParallax();
