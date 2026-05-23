(function () {
  var storageKey = 'track-sp-links';
  var config = window.TRACK_SP_CONFIG || {};
  var supabaseUrl = cleanConfigValue(config.SUPABASE_URL);
  var supabaseKey = cleanConfigValue(config.SUPABASE_ANON_KEY);
  var useSupabase = !!(supabaseUrl && supabaseKey);
  var form = document.getElementById('linkForm');
  var input = document.getElementById('linkInput');
  var message = document.getElementById('message');
  var list = document.getElementById('linksList');
  var emptyState = document.getElementById('emptyState');
  var clearBtn = document.getElementById('clearBtn');
  var links = [];

  function cleanConfigValue(value) {
    return trim(String(value || '')).replace(/\/+$/, '');
  }

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
      window.localStorage.setItem(storageKey, JSON.stringify(localUrls()));
    } catch (error) {
      setMessage('Trinh duyet khong cho luu localStorage.', false);
    }
  }

  function localUrls() {
    var urls = [];
    var i;
    for (i = 0; i < links.length; i += 1) {
      urls.push(links[i].url);
    }
    return urls;
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

  function makeLocalLink(url) {
    return {
      id: null,
      url: url,
      created_at: new Date().toISOString ? new Date().toISOString() : String(new Date().getTime())
    };
  }

  function localLinksFromUrls(urls) {
    var items = [];
    var i;
    for (i = 0; i < urls.length; i += 1) {
      items.push(makeLocalLink(urls[i]));
    }
    return items;
  }

  function request(method, path, body, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, supabaseUrl + path, true);
    xhr.setRequestHeader('apikey', supabaseKey);
    xhr.setRequestHeader('Authorization', 'Bearer ' + supabaseKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Prefer', 'return=representation');
    xhr.onreadystatechange = function () {
      var data = null;
      if (xhr.readyState !== 4) {
        return;
      }
      if (xhr.responseText) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch (error) {
          data = null;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        callback(null, data || []);
      } else {
        callback(data || { message: 'Loi ket noi Supabase.' });
      }
    };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function loadSupabaseLinks() {
    setMessage('Dang tai du lieu...', true);
    request('GET', '/rest/v1/links?select=id,url,created_at&order=created_at.desc', null, function (error, data) {
      if (error) {
        links = localLinksFromUrls(loadLinks());
        render();
        setMessage('Khong tai duoc Supabase, dang dung du lieu local.', false);
        return;
      }
      links = data || [];
      render();
      setMessage('Dang luu online bang Supabase.', true);
    });
  }

  function addSupabaseLink(url) {
    request('POST', '/rest/v1/links', { url: url }, function (error, data) {
      if (error) {
        setMessage('Khong them duoc link len Supabase.', false);
        return;
      }
      if (data && data.length) {
        links.unshift(data[0]);
      } else {
        links.unshift(makeLocalLink(url));
      }
      render();
      input.value = '';
      input.focus();
      setMessage('Da them link online.', true);
    });
  }

  function deleteSupabaseLink(index) {
    var item = links[index];
    if (!item || item.id === null || typeof item.id === 'undefined') {
      return;
    }
    request('DELETE', '/rest/v1/links?id=eq.' + encodeURIComponent(item.id), null, function (error) {
      if (error) {
        setMessage('Khong xoa duoc link tren Supabase.', false);
        return;
      }
      links.splice(index, 1);
      render();
      setMessage('Da xoa link online.', true);
    });
  }

  function clearSupabaseLinks() {
    request('DELETE', '/rest/v1/links?id=not.is.null', null, function (error) {
      if (error) {
        setMessage('Khong xoa duoc danh sach tren Supabase.', false);
        return;
      }
      links = [];
      render();
      setMessage('Da xoa tat ca link online.', true);
    });
  }

  function render() {
    var html = '';
    var i;

    for (i = 0; i < links.length; i += 1) {
      html += '<li>';
      html += '<span class="link-title">' + escapeHtml(getTitle(links[i].url)) + '</span>';
      html += '<span class="link-url">' + escapeHtml(links[i].url) + '</span>';
      html += '<div class="actions">';
      html += '<a href="' + escapeHtml(links[i].url) + '" target="_blank" rel="noopener">Mo link</a>';
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

    if (useSupabase) {
      addSupabaseLink(url);
      return false;
    }

    links.unshift(makeLocalLink(url));
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
        if (useSupabase) {
          deleteSupabaseLink(index);
        } else {
          links.splice(index, 1);
          saveLinks();
          render();
          setMessage('Da xoa link.', true);
        }
      }
    }
  };

  clearBtn.onclick = function () {
    if (useSupabase) {
      clearSupabaseLinks();
    } else {
      links = [];
      saveLinks();
      render();
      setMessage('Da xoa tat ca link.', true);
    }
  };

  if (useSupabase) {
    loadSupabaseLinks();
  } else {
    links = localLinksFromUrls(loadLinks());
    render();
    setMessage('Dang luu tren trinh duyet nay. Dien Supabase trong config.js de luu online.', false);
  }
}());
