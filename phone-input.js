/*
 * Merlin — shared international phone input.
 * Used by access.html (signup form) and contact.html.
 * No dependencies. Exposes window.MerlinPhone.
 *
 * Usage:
 *   <select id="phoneCountry"></select>
 *   <input id="phoneNumber" type="tel" inputmode="tel" placeholder="(123) 456-7890">
 *   MerlinPhone.attach(document.getElementById('phoneCountry'), document.getElementById('phoneNumber'));
 *   ...
 *   const full = MerlinPhone.getFullNumber(selectEl, inputEl); // "" if empty, else "+1 (123) 456-7890"
 */
(function (global) {
  'use strict';

  // ~20 common countries. US is first/default.
  var COUNTRIES = [
    { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'United States' },
    { code: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada' },
    { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
    { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia' },
    { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany' },
    { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France' },
    { code: 'ES', dial: '+34',  flag: '🇪🇸', name: 'Spain' },
    { code: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Italy' },
    { code: 'NL', dial: '+31',  flag: '🇳🇱', name: 'Netherlands' },
    { code: 'IE', dial: '+353', flag: '🇮🇪', name: 'Ireland' },
    { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
    { code: 'MX', dial: '+52',  flag: '🇲🇽', name: 'Mexico' },
    { code: 'BR', dial: '+55',  flag: '🇧🇷', name: 'Brazil' },
    { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India' },
    { code: 'CN', dial: '+86',  flag: '🇨🇳', name: 'China' },
    { code: 'JP', dial: '+81',  flag: '🇯🇵', name: 'Japan' },
    { code: 'KR', dial: '+82',  flag: '🇰🇷', name: 'South Korea' },
    { code: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore' },
    { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
    { code: 'ZA', dial: '+27',  flag: '🇿🇦', name: 'South Africa' },
    { code: 'NZ', dial: '+64',  flag: '🇳🇿', name: 'New Zealand' }
  ];

  function formatUS(digits) {
    digits = digits.replace(/\D/g, '').slice(0, 10);
    var len = digits.length;
    if (len === 0) return '';
    if (len < 4) return '(' + digits;
    if (len < 7) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  }

  function buildOptions(selectEl) {
    selectEl.innerHTML = '';
    COUNTRIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.dial;
      opt.dataset.code = c.code;
      opt.textContent = c.flag + ' ' + c.dial;
      selectEl.appendChild(opt);
    });
    selectEl.value = '+1';
  }

  function isUS(selectEl) {
    // Default to US formatting whenever +1 is selected (covers CA too — harmless).
    return selectEl.value === '+1';
  }

  function attach(selectEl, inputEl) {
    buildOptions(selectEl);
    inputEl.setAttribute('autocomplete', 'tel-national');
    function reformat() {
      var digits = inputEl.value.replace(/\D/g, '');
      inputEl.value = isUS(selectEl) ? formatUS(digits) : digits;
    }
    inputEl.addEventListener('input', reformat);
    selectEl.addEventListener('change', reformat);
  }

  function getFullNumber(selectEl, inputEl) {
    var digits = (inputEl.value || '').replace(/\D/g, '');
    if (!digits) return '';
    return selectEl.value + ' ' + digits;
  }

  global.MerlinPhone = {
    COUNTRIES: COUNTRIES,
    attach: attach,
    getFullNumber: getFullNumber
  };
})(window);
