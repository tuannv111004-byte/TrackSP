(function () {
  var storageKey = 'track-sp-links';
  var form = document.getElementById('linkForm');
  var input = document.getElementById('linkInput');
  var message = document.getElementById('message');
  var list = document.getElementById('linksList');
  var emptyState = document.getElementById('emptyState');
  var clearBtn = document.getElementById('clearBtn');
  var links = loadLinks();

  function loadLinks() {
    var raw;
    try {
      raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch (error) {
      return [];
    }
  }

  function saveLinks() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(links));
    } catch (error) {
      setMessage('Trinh duyet khong cho luu localStorage.', false);
    }
  }

  function trim(value) {
    return value.replace(/^\s+|\s+$/g, '');
  }

  function normalizeUrl(value) {
    var clean = trim(value);
    if (!clean) {
      return '';
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(clean)) {
      clean = 'https://' + clean;
    }
    return clean;
  }

  function isHttpUrl(value) {
    return /^https?:\/\/[^ ]+\.[^ ]+/i.test(value);
  }

  function getTitle(url) {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  }

  function setMessage(text, ok) {
    message.className = ok ? 'message ok' : 'message';
    message.innerHTML = text;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render() {
    var html = '';
    var i;

    for (i = 0; i < links.length; i += 1) {
      html += '<li>';
      html += '<span class="link-title">' + escapeHtml(getTitle(links[i])) + '</span>';
      html += '<span class="link-url">' + escapeHtml(links[i]) + '</span>';
      html += '<div class="actions">';
      html += '<a href="' + escapeHtml(links[i]) + '" target="_blank" rel="noopener">Mo link</a>';
      html += '<button type="button" data-index="' + i + '">Xoa</button>';
      html += '</div>';
      html += '</li>';
    }

    list.innerHTML = html;
    emptyState.style.display = links.length ? 'none' : 'block';
    clearBtn.style.display = links.length ? 'inline-block' : 'none';
  }

  form.onsubmit = function (event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    var url = normalizeUrl(input.value);
    if (!isHttpUrl(url)) {
      setMessage('Link chua dung. Hay dan link dang https://...', false);
      return false;
    }

    links.unshift(url);
    saveLinks();
    render();
    input.value = '';
    input.focus();
    setMessage('Da them link.', true);
    return false;
  };

  list.onclick = function (event) {
    var target = event.target || event.srcElement;
    var index;

    if (target && target.tagName && target.tagName.toLowerCase() === 'button') {
      index = parseInt(target.getAttribute('data-index'), 10);
      if (!isNaN(index)) {
        links.splice(index, 1);
        saveLinks();
        render();
        setMessage('Da xoa link.', true);
      }
    }
  };

  clearBtn.onclick = function () {
    links = [];
    saveLinks();
    render();
    setMessage('Da xoa tat ca link.', true);
  };

  render();
}());
