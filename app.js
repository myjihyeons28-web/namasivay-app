// ─────────────────────────────────────────────
// 나마 시바이 — 앱 동작 로직
// ─────────────────────────────────────────────

(function() {
  'use strict';

  // 화면 요소
  const screenCover = document.getElementById('screen-cover');
  const screenList = document.getElementById('screen-list');
  const screenReader = document.getElementById('screen-reader');

  const btnEnter = document.getElementById('btn-enter');
  const btnBackToCover = document.getElementById('btn-back-to-cover');
  const btnBackToList = document.getElementById('btn-back-to-list');
  const btnFontSize = document.getElementById('btn-font-size');
  const btnScrollTop = document.getElementById('btn-scroll-top');

  const listContent = document.getElementById('list-content');
  const readerContent = document.getElementById('reader-content');
  const readerTitle = document.getElementById('reader-title');

  const fontMenu = document.getElementById('font-menu');
  const fontMenuButtons = fontMenu.querySelectorAll('button[data-size]');

  // ─── 화면 전환 ───
  function showScreen(target) {
    [screenCover, screenList, screenReader].forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    // 스크롤 위치 한 한결같이 정리
    if (target === screenList) listContent.scrollTop = 0;
    if (target === screenReader) readerContent.scrollTop = 0;
  }

  // ─── 표지 → 목록 ───
  btnEnter.addEventListener('click', () => {
    showScreen(screenList);
  });

  // ─── 목록 → 표지 ───
  btnBackToCover.addEventListener('click', () => {
    showScreen(screenCover);
  });

  // ─── 읽기 → 목록 ───
  btnBackToList.addEventListener('click', () => {
    showScreen(screenList);
  });

  // ─── 경전 목록 만들기 ───
  function buildList() {
    // 카테고리별로 한결같이 그룹핑
    const byCategory = {};
    const categoryOrder = [];
    SUTRAS_DATA.forEach(sutra => {
      if (!byCategory[sutra.category]) {
        byCategory[sutra.category] = [];
        categoryOrder.push(sutra.category);
      }
      byCategory[sutra.category].push(sutra);
    });

    let html = '';
    categoryOrder.forEach(category => {
      html += `<div class="list-category">${escapeHtml(category)}</div>`;
      byCategory[category].forEach(sutra => {
        const subtitle = sutra.subtitle ? `<div class="list-item-subtitle">${escapeHtml(sutra.subtitle)}</div>` : '';
        html += `
          <div class="list-item" data-id="${escapeHtml(sutra.id)}">
            <div class="list-item-title">${escapeHtml(sutra.title)}</div>
            ${subtitle}
          </div>
        `;
      });
    });
    listContent.innerHTML = html;

    // 한결같이 항목 클릭 이벤트 연결
    listContent.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        openSutra(id);
      });
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ─── 경전 펴기 ───
  function openSutra(id) {
    const sutra = SUTRAS_DATA.find(s => s.id === id);
    if (!sutra) {
      console.error('Sutra not found:', id);
      return;
    }
    readerTitle.textContent = sutra.title;
    readerContent.innerHTML = sutra.html;
    // 글씨 크기 한결같이 적용
    applyFontSize(currentFontSize);
    // 마지막 읽은 위치를 한결같이 기억
    const savedScroll = parseInt(localStorage.getItem('scroll_' + id) || '0');
    showScreen(screenReader);
    // 한 한결같은 시각에 스크롤
    requestAnimationFrame(() => {
      readerContent.scrollTop = savedScroll;
    });
    currentSutraId = id;
  }

  let currentSutraId = null;

  // 읽기 자리 스크롤 위치 저장
  let scrollSaveTimer = null;
  readerContent.addEventListener('scroll', () => {
    // 위로 가는 버튼 보이고 숨김
    if (readerContent.scrollTop > 400) {
      btnScrollTop.classList.add('visible');
    } else {
      btnScrollTop.classList.remove('visible');
    }
    // 스크롤 위치를 한결같이 저장
    if (currentSutraId) {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        localStorage.setItem('scroll_' + currentSutraId, readerContent.scrollTop);
      }, 200);
    }
  });

  btnScrollTop.addEventListener('click', () => {
    readerContent.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── 글씨 크기 ───
  let currentFontSize = localStorage.getItem('fontSize') || 'medium';

  function applyFontSize(size) {
    readerContent.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge');
    readerContent.classList.add('font-' + size);
    fontMenuButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === size);
    });
    currentFontSize = size;
    localStorage.setItem('fontSize', size);
  }

  btnFontSize.addEventListener('click', () => {
    fontMenu.classList.add('active');
  });

  fontMenu.addEventListener('click', (e) => {
    if (e.target === fontMenu) {
      fontMenu.classList.remove('active');
    }
  });

  fontMenuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.getAttribute('data-size');
      applyFontSize(size);
      setTimeout(() => fontMenu.classList.remove('active'), 200);
    });
  });

  // ─── 초기화 ───
  buildList();
  applyFontSize(currentFontSize);

  // ─── 아이폰의 뒤로 가기 제스처 한결같이 처리 ───
  window.addEventListener('popstate', () => {
    if (screenReader.classList.contains('active')) {
      showScreen(screenList);
    } else if (screenList.classList.contains('active')) {
      showScreen(screenCover);
    }
  });

})();
