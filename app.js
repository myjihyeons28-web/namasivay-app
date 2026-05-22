// ─────────────────────────────────────────────
// 나마 시바이 — 앱 동작 로직
// ─────────────────────────────────────────────

(function() {
  'use strict';

  // ── 화면 요소 ──
  const screenCover = document.getElementById('screen-cover');
  const screenList = document.getElementById('screen-list');
  const screenReader = document.getElementById('screen-reader');

  const btnEnter = document.getElementById('btn-enter');
  const btnBackToCover = document.getElementById('btn-back-to-cover');
  const btnBackToList = document.getElementById('btn-back-to-list');
  const btnListBookmarks = document.getElementById('btn-list-bookmarks');
  const btnToggleBookmark = document.getElementById('btn-toggle-bookmark');
  const btnReaderSettings = document.getElementById('btn-reader-settings');
  const btnScrollTop = document.getElementById('btn-scroll-top');

  const listContent = document.getElementById('list-content');
  const readerContent = document.getElementById('reader-content');
  const readerTitle = document.getElementById('reader-title');

  const settingsMenu = document.getElementById('settings-menu');
  const settingsButtons = settingsMenu.querySelectorAll('button[data-setting]');
  const bookmarkMenu = document.getElementById('bookmark-menu');
  const bookmarkListContent = document.getElementById('bookmark-list-content');
  const bookmarkToast = document.getElementById('bookmark-toast');

  // 목차 자리
  const btnToc = document.getElementById('btn-toc');
  const tocMenu = document.getElementById('toc-menu');
  const tocListContent = document.getElementById('toc-list-content');

  // 검색 자리
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  const btnInSearch = document.getElementById('btn-in-search');
  const inReaderSearch = document.getElementById('in-reader-search');
  const inReaderSearchInput = document.getElementById('in-reader-search-input');
  const inReaderSearchInfo = document.getElementById('in-reader-search-info');
  const btnSearchPrev = document.getElementById('btn-search-prev');
  const btnSearchNext = document.getElementById('btn-search-next');
  const btnInSearchClose = document.getElementById('btn-in-search-close');

  // 진행 막대
  const readingProgressBar = document.getElementById('reading-progress-bar');

  let currentSutraId = null;

  // ── 읽기 설정 ──
  const settings = {
    font: localStorage.getItem('reader_font') || 'gyeonggi',
    size: localStorage.getItem('reader_size') || 'medium',
    bg: localStorage.getItem('reader_bg') || 'beige',
  };

  function applySettings() {
    const classesToRemove = [];
    readerContent.classList.forEach(cls => {
      if (cls.startsWith('font-') || cls.startsWith('size-') || cls.startsWith('bg-')) {
        classesToRemove.push(cls);
      }
    });
    classesToRemove.forEach(cls => readerContent.classList.remove(cls));

    readerContent.classList.add('font-' + settings.font);
    readerContent.classList.add('size-' + settings.size);
    readerContent.classList.add('bg-' + settings.bg);

    settingsButtons.forEach(btn => {
      const setting = btn.getAttribute('data-setting');
      const value = btn.getAttribute('data-value');
      btn.classList.toggle('active', settings[setting] === value);
    });
  }

  function setSetting(setting, value) {
    settings[setting] = value;
    localStorage.setItem('reader_' + setting, value);
    applySettings();
  }

  settingsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const setting = btn.getAttribute('data-setting');
      const value = btn.getAttribute('data-value');
      setSetting(setting, value);
    });
  });

  // ── 화면 전환 ──
  function showScreen(target) {
    [screenCover, screenList, screenReader].forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    if (target === screenList) {
      updateBookmarkIndicator();
    }
    if (target !== screenReader) {
      // 본문 검색 자리 닫음
      closeInReaderSearch();
    }
  }

  btnEnter.addEventListener('click', () => showScreen(screenList));
  btnBackToCover.addEventListener('click', () => showScreen(screenCover));
  btnBackToList.addEventListener('click', () => {
    localStorage.removeItem('last_sutra');
    currentSutraId = null;
    showScreen(screenList);
  });

  // ── HTML 이스케이프 ──
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── 경전 목록 ──
  function buildList() {
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

    listContent.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        openSutra(id);
      });
    });
  }

  // ── 경전 펴기 ──
  function openSutra(id, scrollPos, searchQuery) {
    const sutra = SUTRAS_DATA.find(s => s.id === id);
    if (!sutra) {
      console.error('Sutra not found:', id);
      return;
    }
    readerTitle.textContent = sutra.title;
    readerContent.innerHTML = sutra.html;
    applySettings();
    currentSutraId = id;
    localStorage.setItem('last_sutra', id);
    updateBookmarkToggleButton();
    closeInReaderSearch();

    const savedScroll = scrollPos !== undefined ? scrollPos : parseInt(localStorage.getItem('scroll_' + id) || '0');
    showScreen(screenReader);

    requestAnimationFrame(() => {
      readerContent.scrollTop = savedScroll;
      updateProgressBar();

      // 검색어가 주어졌으면 검색 자리 열고 그 자리로 옮김
      if (searchQuery) {
        openInReaderSearch(searchQuery);
      }
    });
  }

  // ── 스크롤 자리 ──
  let scrollSaveTimer = null;
  let bookmarkUpdateTimer = null;
  let progressUpdateTimer = null;

  readerContent.addEventListener('scroll', () => {
    if (readerContent.scrollTop > 400) {
      btnScrollTop.classList.add('visible');
    } else {
      btnScrollTop.classList.remove('visible');
    }
    if (currentSutraId) {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        localStorage.setItem('scroll_' + currentSutraId, readerContent.scrollTop);
      }, 200);
    }
    clearTimeout(bookmarkUpdateTimer);
    bookmarkUpdateTimer = setTimeout(updateBookmarkToggleButton, 300);

    // 진행 막대 갱신
    clearTimeout(progressUpdateTimer);
    progressUpdateTimer = setTimeout(updateProgressBar, 10);
  });

  // 앱이 가려지거나(백그라운드) 닫히기 직전, 보던 자리를 즉시 저장한다.
  // iOS가 백그라운드에서 앱을 종료해도 마지막 자리를 잃지 않도록 함.
  function saveCurrentPositionNow() {
    if (currentSutraId) {
      localStorage.setItem('scroll_' + currentSutraId, readerContent.scrollTop);
      localStorage.setItem('last_sutra', currentSutraId);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveCurrentPositionNow();
    }
  });
  window.addEventListener('pagehide', saveCurrentPositionNow);

  btnScrollTop.addEventListener('click', () => {
    readerContent.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── 진행 막대 ──
  function updateProgressBar() {
    const scrollTop = readerContent.scrollTop;
    const scrollHeight = readerContent.scrollHeight;
    const clientHeight = readerContent.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll <= 0) {
      readingProgressBar.style.width = '0%';
      return;
    }
    const percent = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
    readingProgressBar.style.width = percent + '%';
  }

  // ── 설정 모달 ──
  btnReaderSettings.addEventListener('click', () => settingsMenu.classList.add('active'));
  settingsMenu.addEventListener('click', e => {
    if (e.target === settingsMenu) settingsMenu.classList.remove('active');
  });

  // ───────────────────────────────────────
  // 전체 검색 (경전 목록 화면)
  // ───────────────────────────────────────
  let searchDebounceTimer = null;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    searchClear.classList.toggle('visible', query.length > 0);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      if (query.length === 0) {
        buildList();
      } else {
        renderGlobalSearchResults(query);
      }
    }, 200);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    buildList();
    searchInput.focus();
  });

  function renderGlobalSearchResults(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    SUTRAS_DATA.forEach(sutra => {
      // HTML 본문에서 텍스트만 뽑음
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sutra.html;
      const fullText = tempDiv.textContent || '';

      // 검색어가 들어 있는지
      const lowerText = fullText.toLowerCase();
      let idx = lowerText.indexOf(lowerQuery);
      if (idx === -1) return;

      // 그 경전에서 검색어가 들어 있는 모든 자리 찾기
      let count = 0;
      let searchIdx = 0;
      const snippets = [];
      while ((searchIdx = lowerText.indexOf(lowerQuery, searchIdx)) !== -1) {
        count++;
        // 첫 세 자리만 미리보기 자리로 모음
        if (snippets.length < 1) {
          const start = Math.max(0, searchIdx - 30);
          const end = Math.min(fullText.length, searchIdx + query.length + 50);
          let snippet = fullText.substring(start, end);
          if (start > 0) snippet = '…' + snippet;
          if (end < fullText.length) snippet = snippet + '…';
          snippets.push(snippet);
        }
        searchIdx += lowerQuery.length;
      }

      results.push({
        sutra: sutra,
        count: count,
        snippet: snippets[0] || '',
      });
    });

    // 검색어 들어 있는 횟수 많은 자리 먼저
    results.sort((a, b) => b.count - a.count);

    if (results.length === 0) {
      listContent.innerHTML = `<div class="search-no-results">"${escapeHtml(query)}"<br>이 단어가 들어 있는 자리를 찾지 못했습니다</div>`;
      return;
    }

    const re = new RegExp('(' + escapeRegex(query) + ')', 'gi');
    let html = `<div class="search-results-info">"${escapeHtml(query)}" — ${results.length}개 경전에서 찾음</div>`;
    results.forEach(r => {
      const highlightedSnippet = escapeHtml(r.snippet).replace(re, '<mark>$1</mark>');
      html += `
        <div class="search-result-item" data-id="${escapeHtml(r.sutra.id)}" data-query="${escapeHtml(query)}">
          <div class="search-result-sutra">${escapeHtml(r.sutra.title)}</div>
          <div class="search-result-snippet">${highlightedSnippet}</div>
          <div class="search-result-count">${r.count}회 들어 있음</div>
        </div>
      `;
    });
    listContent.innerHTML = html;

    listContent.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const q = item.getAttribute('data-query');
        openSutra(id, 0, q);
      });
    });
  }

  // ───────────────────────────────────────
  // 본문 안 검색
  // ───────────────────────────────────────
  let searchHitNodes = [];  // 검색 결과 노드들
  let currentSearchIdx = -1;

  function openInReaderSearch(query) {
    inReaderSearch.classList.add('active');
    if (query !== undefined) {
      inReaderSearchInput.value = query;
      performInReaderSearch(query);
    } else {
      setTimeout(() => inReaderSearchInput.focus(), 100);
    }
  }

  function closeInReaderSearch() {
    inReaderSearch.classList.remove('active');
    clearInReaderSearchHighlights();
    inReaderSearchInput.value = '';
    searchHitNodes = [];
    currentSearchIdx = -1;
  }

  btnInSearch.addEventListener('click', () => openInReaderSearch());
  btnInSearchClose.addEventListener('click', closeInReaderSearch);

  let inReaderSearchDebounce = null;
  inReaderSearchInput.addEventListener('input', () => {
    clearTimeout(inReaderSearchDebounce);
    inReaderSearchDebounce = setTimeout(() => {
      performInReaderSearch(inReaderSearchInput.value.trim());
    }, 150);
  });

  inReaderSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchHitNodes.length > 0) {
        goToNextSearchHit();
      }
    } else if (e.key === 'Escape') {
      closeInReaderSearch();
    }
  });

  btnSearchPrev.addEventListener('click', goToPrevSearchHit);
  btnSearchNext.addEventListener('click', goToNextSearchHit);

  function clearInReaderSearchHighlights() {
    const marks = readerContent.querySelectorAll('mark.search-hit');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
  }

  function performInReaderSearch(query) {
    clearInReaderSearchHighlights();
    searchHitNodes = [];
    currentSearchIdx = -1;

    if (!query || query.length === 0) {
      inReaderSearchInfo.textContent = '0 / 0';
      updateSearchNavButtons();
      return;
    }

    const lowerQuery = query.toLowerCase();
    // 텍스트 노드 가운데에서 검색어를 찾아 mark로 감쌈
    const walker = document.createTreeWalker(readerContent, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      // mark 안의 자리는 건너뜀
      if (node.parentNode && node.parentNode.tagName === 'MARK') continue;
      if (node.nodeValue && node.nodeValue.toLowerCase().indexOf(lowerQuery) !== -1) {
        textNodes.push(node);
      }
    }

    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      const lowerText = text.toLowerCase();
      const fragments = [];
      let lastIdx = 0;
      let idx;
      while ((idx = lowerText.indexOf(lowerQuery, lastIdx)) !== -1) {
        if (idx > lastIdx) {
          fragments.push({ text: text.substring(lastIdx, idx), highlight: false });
        }
        fragments.push({ text: text.substring(idx, idx + query.length), highlight: true });
        lastIdx = idx + query.length;
      }
      if (lastIdx < text.length) {
        fragments.push({ text: text.substring(lastIdx), highlight: false });
      }

      const wrapper = document.createDocumentFragment();
      fragments.forEach(f => {
        if (f.highlight) {
          const mark = document.createElement('mark');
          mark.className = 'search-hit';
          mark.textContent = f.text;
          wrapper.appendChild(mark);
          searchHitNodes.push(mark);
        } else {
          wrapper.appendChild(document.createTextNode(f.text));
        }
      });

      textNode.parentNode.replaceChild(wrapper, textNode);
    });

    if (searchHitNodes.length > 0) {
      currentSearchIdx = 0;
      highlightCurrentSearch();
    }
    updateSearchInfo();
    updateSearchNavButtons();
  }

  function highlightCurrentSearch() {
    searchHitNodes.forEach(n => n.classList.remove('current'));
    if (currentSearchIdx >= 0 && currentSearchIdx < searchHitNodes.length) {
      const node = searchHitNodes[currentSearchIdx];
      node.classList.add('current');
      // 그 자리로 부드럽게 스크롤
      const rect = node.getBoundingClientRect();
      const contentRect = readerContent.getBoundingClientRect();
      const offset = rect.top - contentRect.top + readerContent.scrollTop - (contentRect.height / 3);
      readerContent.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }

  function goToNextSearchHit() {
    if (searchHitNodes.length === 0) return;
    currentSearchIdx = (currentSearchIdx + 1) % searchHitNodes.length;
    highlightCurrentSearch();
    updateSearchInfo();
  }

  function goToPrevSearchHit() {
    if (searchHitNodes.length === 0) return;
    currentSearchIdx = (currentSearchIdx - 1 + searchHitNodes.length) % searchHitNodes.length;
    highlightCurrentSearch();
    updateSearchInfo();
  }

  function updateSearchInfo() {
    if (searchHitNodes.length === 0) {
      inReaderSearchInfo.textContent = '0 / 0';
    } else {
      inReaderSearchInfo.textContent = (currentSearchIdx + 1) + ' / ' + searchHitNodes.length;
    }
  }

  function updateSearchNavButtons() {
    const disabled = searchHitNodes.length === 0;
    btnSearchPrev.disabled = disabled;
    btnSearchNext.disabled = disabled;
  }

  // ───────────────────────────────────────
  // 책갈피
  // ───────────────────────────────────────
  function loadBookmarks() {
    try {
      return JSON.parse(localStorage.getItem('bookmarks') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBookmarks(bookmarks) {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }

  function getCurrentSnippet() {
    const scrollTop = readerContent.scrollTop;
    const paragraphs = readerContent.querySelectorAll('p, h2, h3');
    let snippet = '';
    for (const p of paragraphs) {
      if (p.offsetTop >= scrollTop - 20) {
        snippet = (p.textContent || '').trim();
        if (snippet.length > 0) break;
      }
    }
    if (snippet.length > 100) {
      snippet = snippet.substring(0, 100) + '...';
    }
    return snippet || '(본문 시작)';
  }

  function isBookmarkedHere() {
    if (!currentSutraId) return false;
    const bookmarks = loadBookmarks();
    const currentScroll = readerContent.scrollTop;
    return bookmarks.some(b =>
      b.sutraId === currentSutraId &&
      Math.abs(b.scrollPos - currentScroll) < 100
    );
  }

  function updateBookmarkToggleButton() {
    if (isBookmarkedHere()) {
      btnToggleBookmark.classList.add('bookmark-active');
    } else {
      btnToggleBookmark.classList.remove('bookmark-active');
    }
  }

  function updateBookmarkIndicator() {
    const bookmarks = loadBookmarks();
    if (bookmarks.length > 0) {
      btnListBookmarks.classList.add('has-bookmarks');
    } else {
      btnListBookmarks.classList.remove('has-bookmarks');
    }
  }

  btnToggleBookmark.addEventListener('click', () => {
    if (!currentSutraId) return;
    const sutra = SUTRAS_DATA.find(s => s.id === currentSutraId);
    if (!sutra) return;

    const bookmarks = loadBookmarks();
    const currentScroll = readerContent.scrollTop;
    const existingIdx = bookmarks.findIndex(b =>
      b.sutraId === currentSutraId &&
      Math.abs(b.scrollPos - currentScroll) < 100
    );

    if (existingIdx !== -1) {
      bookmarks.splice(existingIdx, 1);
      saveBookmarks(bookmarks);
      showToast('책갈피 제거됨');
    } else {
      const newBookmark = {
        id: Date.now().toString(),
        sutraId: currentSutraId,
        sutraTitle: sutra.title,
        scrollPos: currentScroll,
        snippet: getCurrentSnippet(),
        timestamp: Date.now()
      };
      bookmarks.unshift(newBookmark);
      saveBookmarks(bookmarks);
      showToast('책갈피 추가됨');
    }

    updateBookmarkToggleButton();
    updateBookmarkIndicator();
  });

  let toastTimer = null;
  function showToast(message) {
    bookmarkToast.textContent = message;
    bookmarkToast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      bookmarkToast.classList.remove('visible');
    }, 1800);
  }

  btnListBookmarks.addEventListener('click', () => {
    renderBookmarkList();
    bookmarkMenu.classList.add('active');
  });

  bookmarkMenu.addEventListener('click', e => {
    if (e.target === bookmarkMenu) bookmarkMenu.classList.remove('active');
  });

  function renderBookmarkList() {
    const bookmarks = loadBookmarks();
    if (bookmarks.length === 0) {
      bookmarkListContent.innerHTML = '<div class="bookmark-empty">아직 저장된 책갈피가 없습니다.<br><br>경전을 펴신 후 위쪽 책갈피 모양 버튼을 누르시면<br>현재 자리가 책갈피로 저장됩니다.</div>';
      return;
    }

    let html = '';
    bookmarks.forEach(b => {
      const date = new Date(b.timestamp);
      const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
      html += `
        <div class="bookmark-item" data-id="${escapeHtml(b.id)}">
          <div class="bookmark-item-content" data-action="open">
            <div class="bookmark-item-sutra">${escapeHtml(b.sutraTitle)}</div>
            <div class="bookmark-item-snippet">${escapeHtml(b.snippet)}</div>
            <div class="bookmark-item-time">${dateStr}</div>
          </div>
          <button class="bookmark-item-delete" data-action="delete" aria-label="삭제">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
    });
    bookmarkListContent.innerHTML = html;

    bookmarkListContent.querySelectorAll('.bookmark-item').forEach(item => {
      const bookmarkId = item.getAttribute('data-id');
      const contentArea = item.querySelector('[data-action="open"]');
      const deleteBtn = item.querySelector('[data-action="delete"]');

      contentArea.addEventListener('click', () => {
        const bookmarks = loadBookmarks();
        const bm = bookmarks.find(b => b.id === bookmarkId);
        if (bm) {
          bookmarkMenu.classList.remove('active');
          openSutra(bm.sutraId, bm.scrollPos);
        }
      });

      deleteBtn.addEventListener('click', e => {
        e.stopPropagation();
        const bookmarks = loadBookmarks();
        const idx = bookmarks.findIndex(b => b.id === bookmarkId);
        if (idx !== -1) {
          bookmarks.splice(idx, 1);
          saveBookmarks(bookmarks);
          renderBookmarkList();
          updateBookmarkIndicator();
          updateBookmarkToggleButton();
        }
      });
    });
  }

  // ── 초기화 ──
  buildList();
  applySettings();
  updateBookmarkIndicator();

  // 마지막에 보던 경전이 있으면 자동으로 그 자리에서 이어 펴기
  // (iOS가 백그라운드에서 앱을 닫아도 보던 경전과 자리를 잃지 않도록)
  (function restoreLastSutra() {
    try {
      const lastId = localStorage.getItem('last_sutra');
      if (lastId && SUTRAS_DATA.find(s => s.id === lastId)) {
        // 표지 화면을 먼저 내리고 곧장 그 경전을 편다
        screenCover.classList.remove('active');
        openSutra(lastId);
      }
    } catch (e) {
      console.error('이어 보기 복원 실패:', e);
    }
  })();

  // ───────────────────────────────────────
  // 목차
  // ───────────────────────────────────────
  btnToc.addEventListener('click', () => {
    renderToc();
    tocMenu.classList.add('active');
  });

  tocMenu.addEventListener('click', e => {
    if (e.target === tocMenu) tocMenu.classList.remove('active');
  });

  function renderToc() {
    if (!currentSutraId) {
      tocListContent.innerHTML = '<div class="toc-empty">경전을 펴신 후에 목차가 한 자리에 모입니다.</div>';
      return;
    }

    // 본문 안의 모든 h2.chapter와 h3.subhead를 한 자리에 모음
    const headings = readerContent.querySelectorAll('h2.chapter, h3.subhead');
    if (headings.length === 0) {
      tocListContent.innerHTML = '<div class="toc-empty">이 경전에는 따로 나뉜 장이 없습니다.<br><br>본문을 그대로 한 호흡씩 펴 보십시오.</div>';
      return;
    }

    let html = '';
    headings.forEach((h, idx) => {
      const text = (h.textContent || '').trim();
      if (!text) return;
      const level = h.tagName === 'H2' ? 2 : 3;
      // 본문 안에서 그 자리로 옮길 수 있도록 한 id를 더해 둠
      if (!h.id) {
        h.id = 'toc-target-' + idx;
      }
      html += `<div class="toc-item level-${level}" data-target="${h.id}">${escapeHtml(text)}</div>`;
    });

    if (!html) {
      tocListContent.innerHTML = '<div class="toc-empty">이 경전에는 따로 나뉜 장이 없습니다.<br><br>본문을 그대로 한 호흡씩 펴 보십시오.</div>';
      return;
    }

    tocListContent.innerHTML = html;

    tocListContent.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        const targetEl = readerContent.querySelector('#' + CSS.escape(targetId));
        tocMenu.classList.remove('active');
        if (targetEl) {
          // 헤더 자리 아래로 한 작은 여유를 두고 옮김
          const rect = targetEl.getBoundingClientRect();
          const contentRect = readerContent.getBoundingClientRect();
          const offset = rect.top - contentRect.top + readerContent.scrollTop - 16;
          requestAnimationFrame(() => {
            readerContent.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
          });
        }
      });
    });
  }

})();
