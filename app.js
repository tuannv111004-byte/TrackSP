(function () {
  var linkStorageKey = 'track-sp-links';
  var deviceStorageKey = 'track-sp-devices';
  var readyAfterMs = 24 * 60 * 60 * 1000;
  var config = window.TRACK_SP_CONFIG || {};
  var supabaseUrl = cleanConfigValue(config.SUPABASE_URL);
  var supabaseKey = cleanConfigValue(config.SUPABASE_ANON_KEY);
  var linksOnline = !!(supabaseUrl && supabaseKey);
  var devicesOnline = !!(supabaseUrl && supabaseKey);

  var tabButtons = document.getElementsByClassName('tab');
  var linksView = document.getElementById('linksView');
  var devicesView = document.getElementById('devicesView');

  var linkForm = document.getElementById('linkForm');
  var linkInput = document.getElementById('linkInput');
  var linkMessage = document.getElementById('linkMessage');
  var linksList = document.getElementById('linksList');
  var linksEmptyState = document.getElementById('linksEmptyState');
  var clearLinksBtn = document.getElementById('clearLinksBtn');

  var deviceForm = document.getElementById('deviceForm');
  var deviceInput = document.getElementById('deviceInput');
  var startInput = document.getElementById('startInput');
  var deviceMessage = document.getElementById('deviceMessage');
  var devicesList = document.getElementById('devicesList');
  var devicesEmptyState = document.getElementById('devicesEmptyState');
  var clearDevicesBtn = document.getElementById('clearDevicesBtn');
  var totalCount = document.getElementById('totalCount');
  var pendingCount = document.getElementById('pendingCount');
  var readyCount = document.getElementById('readyCount');

  var links = [];
  var devices = [];

  function switchTab(tabName) {
    var i;
    for (i = 0; i < tabButtons.length; i += 1) {
      if (tabButtons[i].getAttribute('data-tab') === tabName) {
        tabButtons[i].className = 'tab active';
      } else {
        tabButtons[i].className = 'tab';
      }
    }

    linksView.className = tabName === 'links' ? 'tab-view active' : 'tab-view';
    devicesView.className = tabName === 'devices' ? 'tab-view active' : 'tab-view';
  }

  function bindTabs() {
    var i;
    for (i = 0; i < tabButtons.length; i += 1) {
      tabButtons[i].onclick = function () {
        switchTab(this.getAttribute('data-tab'));
      };
    }
  }

  function trim(value) {
    return value.replace(/^\s+|\s+$/g, '');
  }

  function cleanConfigValue(value) {
    return trim(String(value || '')).replace(/\/+$/, '');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setMessage(element, text, ok) {
    element.className = ok ? 'message ok' : 'message';
    element.innerHTML = text;
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

  function loadLocal(key, fallback) {
    var raw;
    try {
      raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveLocal(key, value, messageElement) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      setMessage(messageElement, 'Trinh duyet khong cho luu localStorage.', false);
    }
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

  function makeLink(url) {
    return {
      id: null,
      url: url,
      created_at: new Date().toISOString()
    };
  }

  function linkUrls() {
    var urls = [];
    var i;
    for (i = 0; i < links.length; i += 1) {
      urls.push(links[i].url);
    }
    return urls;
  }

  function linksFromUrls(urls) {
    var items = [];
    var i;
    for (i = 0; i < urls.length; i += 1) {
      items.push(makeLink(urls[i]));
    }
    return items;
  }

  function loadLinksOnline() {
    setMessage(linkMessage, 'Dang tai link...', true);
    request('GET', '/rest/v1/links?select=id,url,created_at&order=created_at.desc', null, function (error, data) {
      if (error) {
        linksOnline = false;
        links = linksFromUrls(loadLocal(linkStorageKey, []));
        renderLinks();
        setMessage(linkMessage, 'Khong tai duoc link online, dang dung du lieu local.', false);
        return;
      }
      links = data || [];
      renderLinks();
      setMessage(linkMessage, 'Link dang luu online bang Supabase.', true);
    });
  }

  function addLinkOnline(url) {
    request('POST', '/rest/v1/links', { url: url }, function (error, data) {
      if (error) {
        linksOnline = false;
        links.unshift(makeLink(url));
        saveLocal(linkStorageKey, linkUrls(), linkMessage);
        renderLinks();
        setMessage(linkMessage, 'Khong them duoc link online, da luu local.', false);
        return;
      }
      links.unshift(data && data.length ? data[0] : makeLink(url));
      renderLinks();
      setMessage(linkMessage, 'Da them link online.', true);
    });
  }

  function deleteLinkOnline(index) {
    var item = links[index];
    if (!item || item.id === null || typeof item.id === 'undefined') {
      return;
    }
    request('DELETE', '/rest/v1/links?id=eq.' + encodeURIComponent(item.id), null, function (error) {
      if (error) {
        setMessage(linkMessage, 'Khong xoa duoc link tren Supabase.', false);
        return;
      }
      links.splice(index, 1);
      renderLinks();
      setMessage(linkMessage, 'Da xoa link online.', true);
    });
  }

  function clearLinksOnline() {
    request('DELETE', '/rest/v1/links?id=not.is.null', null, function (error) {
      if (error) {
        setMessage(linkMessage, 'Khong xoa duoc danh sach link online.', false);
        return;
      }
      links = [];
      renderLinks();
      setMessage(linkMessage, 'Da xoa tat ca link online.', true);
    });
  }

  function renderLinks() {
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

    linksList.innerHTML = html;
    linksEmptyState.style.display = links.length ? 'none' : 'block';
    clearLinksBtn.style.display = links.length ? 'inline-block' : 'none';
  }

  function nowMs() {
    return new Date().getTime();
  }

  function toIso(time) {
    return new Date(time).toISOString();
  }

  function timeInputToIso(value) {
    var parts;
    var date;
    var hours;
    var minutes;
    if (!value) {
      return null;
    }
    parts = value.split(':');
    if (parts.length < 2 || isNaN(parseInt(parts[0], 10)) || isNaN(parseInt(parts[1], 10))) {
      return null;
    }
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return toIso(date.getTime());
  }

  function parseTime(value) {
    var time = new Date(value).getTime();
    return isNaN(time) ? nowMs() : time;
  }

  function makeDevice(name) {
    return {
      id: null,
      name: name,
      registered_at: toIso(nowMs()),
      started_at: null
    };
  }

  function readyTime(device) {
    return parseTime(device.started_at) + readyAfterMs;
  }

  function isReady(device) {
    return !!device.started_at && nowMs() >= readyTime(device);
  }

  function isRunning(device) {
    return !!device.started_at && !isReady(device);
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatDuration(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function loadDevicesOnline() {
    setMessage(deviceMessage, 'Dang tai thiet bi...', true);
    request('GET', '/rest/v1/devices?select=id,name,registered_at,started_at&order=registered_at.desc', null, function (error, data) {
      if (error) {
        devicesOnline = false;
        devices = loadLocal(deviceStorageKey, []);
        renderDevices();
        setMessage(deviceMessage, 'Chua co bang devices online, thiet bi dang luu local.', false);
        return;
      }
      devices = data || [];
      renderDevices();
      setMessage(deviceMessage, 'Thiet bi dang luu online bang Supabase.', true);
    });
  }

  function addDeviceOnline(device) {
    request('POST', '/rest/v1/devices', {
      name: device.name,
      registered_at: device.registered_at,
      started_at: device.started_at
    }, function (error, data) {
      if (error) {
        devicesOnline = false;
        devices.unshift(device);
        saveLocal(deviceStorageKey, devices, deviceMessage);
        renderDevices();
        setMessage(deviceMessage, 'Khong them duoc thiet bi online, da luu local.', false);
        return;
      }
      devices.unshift(data && data.length ? data[0] : device);
      renderDevices();
      setMessage(deviceMessage, 'Da dang ky thiet bi online.', true);
    });
  }

  function deleteDeviceOnline(index) {
    var item = devices[index];
    if (!item || item.id === null || typeof item.id === 'undefined') {
      return;
    }
    request('DELETE', '/rest/v1/devices?id=eq.' + encodeURIComponent(item.id), null, function (error) {
      if (error) {
        setMessage(deviceMessage, 'Khong xoa duoc thiet bi online.', false);
        return;
      }
      devices.splice(index, 1);
      renderDevices();
      setMessage(deviceMessage, 'Da xoa thiet bi online.', true);
    });
  }

  function clearDevicesOnline() {
    request('DELETE', '/rest/v1/devices?id=not.is.null', null, function (error) {
      if (error) {
        setMessage(deviceMessage, 'Khong xoa duoc danh sach thiet bi online.', false);
        return;
      }
      devices = [];
      renderDevices();
      setMessage(deviceMessage, 'Da xoa tat ca thiet bi online.', true);
    });
  }

  function saveDeviceStartOnline(index) {
    request('PATCH', '/rest/v1/devices?id=eq.' + encodeURIComponent(devices[index].id), {
      started_at: devices[index].started_at
    }, function (error) {
      if (error) {
        setMessage(deviceMessage, 'Khong bat dau duoc thiet bi online.', false);
        return;
      }
      renderDevices();
      setMessage(deviceMessage, 'Da bat dau moc 24 gio.', true);
    });
  }

  function renderDevices() {
    var html = '';
    var ready = 0;
    var i;
    var device;
    var readyAt;
    var status;
    var running = 0;

    for (i = 0; i < devices.length; i += 1) {
      device = devices[i];
      readyAt = device.started_at ? readyTime(device) : null;
      status = getDeviceStatus(device);
      if (isReady(device)) {
        ready += 1;
      }
      if (isRunning(device)) {
        running += 1;
      }

      html += '<li class="' + status.className + '">';
      html += '<div class="device-main">';
      html += '<span class="device-name">' + escapeHtml(device.name) + '</span>';
      html += '<span class="device-status">' + status.label + '</span>';
      html += '</div>';
      html += '<div class="device-meta">';
      html += '<span>Da dang ky: ' + escapeHtml(formatDate(device.registered_at)) + '</span>';
      if (device.started_at) {
        html += '<span>Bat dau: ' + escapeHtml(formatDate(device.started_at)) + '</span>';
        html += '<span>San sang luc: ' + escapeHtml(formatDate(readyAt)) + '</span>';
      }
      html += '</div>';
      html += '<div class="countdown">' + getDeviceCountdown(device) + '</div>';
      html += '<div class="actions">';
      html += '<input class="inline-time-input" type="text" inputmode="numeric" maxlength="5" placeholder="08:30" data-action="time" data-index="' + i + '">';
      html += '<button type="button" data-action="start" data-index="' + i + '">' + (device.started_at ? 'Bat dau lai 24h' : 'Bat dau 24h') + '</button>';
      html += '<button type="button" data-action="delete" data-index="' + i + '">Xoa</button>';
      html += '</div>';
      html += '</li>';
    }

    devicesList.innerHTML = html;
    devicesEmptyState.style.display = devices.length ? 'none' : 'block';
    clearDevicesBtn.style.display = devices.length ? 'inline-block' : 'none';
    totalCount.innerHTML = String(devices.length);
    readyCount.innerHTML = String(ready);
    pendingCount.innerHTML = String(running);
  }

  function getDeviceStatus(device) {
    if (!device.started_at) {
      return {
        className: 'registered',
        label: 'Da dang ky'
      };
    }
    if (isReady(device)) {
      return {
        className: 'ready',
        label: 'San sang'
      };
    }
    return {
      className: 'pending',
      label: 'Dang dem'
    };
  }

  function getDeviceCountdown(device) {
    if (!device.started_at) {
      return 'Chua bat dau 24 gio';
    }
    if (isReady(device)) {
      return 'Da du 24 gio';
    }
    return 'Con lai ' + formatDuration(readyTime(device) - nowMs());
  }

  linkForm.onsubmit = function (event) {
    var url;
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    url = normalizeUrl(linkInput.value);
    if (!isHttpUrl(url)) {
      setMessage(linkMessage, 'Link chua dung. Hay dan link dang https://...', false);
      return false;
    }

    linkInput.value = '';
    linkInput.focus();
    if (linksOnline) {
      addLinkOnline(url);
    } else {
      links.unshift(makeLink(url));
      saveLocal(linkStorageKey, linkUrls(), linkMessage);
      renderLinks();
      setMessage(linkMessage, 'Da them link.', true);
    }
    return false;
  };

  linksList.onclick = function (event) {
    var target = event.target || event.srcElement;
    var index;
    if (!target || !target.tagName || target.tagName.toLowerCase() !== 'button') {
      return;
    }
    index = parseInt(target.getAttribute('data-index'), 10);
    if (isNaN(index)) {
      return;
    }
    if (linksOnline) {
      deleteLinkOnline(index);
    } else {
      links.splice(index, 1);
      saveLocal(linkStorageKey, linkUrls(), linkMessage);
      renderLinks();
      setMessage(linkMessage, 'Da xoa link.', true);
    }
  };

  clearLinksBtn.onclick = function () {
    if (linksOnline) {
      clearLinksOnline();
    } else {
      links = [];
      saveLocal(linkStorageKey, [], linkMessage);
      renderLinks();
      setMessage(linkMessage, 'Da xoa tat ca link.', true);
    }
  };

  deviceForm.onsubmit = function (event) {
    var name;
    var device;
    var startAt;
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    name = trim(deviceInput.value);
    if (!name) {
      setMessage(deviceMessage, 'Hay nhap ten hoac ma thiet bi.', false);
      return false;
    }

    device = makeDevice(name);
    startAt = timeInputToIso(startInput.value);
    if (startInput.value && !startAt) {
      setMessage(deviceMessage, 'Gio bat dau chua dung. Hay nhap dang HH:mm.', false);
      return false;
    }
    device.started_at = startAt;
    deviceInput.value = '';
    startInput.value = '';
    deviceInput.focus();
    if (devicesOnline) {
      addDeviceOnline(device);
    } else {
      devices.unshift(device);
      saveLocal(deviceStorageKey, devices, deviceMessage);
      renderDevices();
      setMessage(deviceMessage, 'Da dang ky thiet bi.', true);
    }
    return false;
  };

  devicesList.onclick = function (event) {
    var target = event.target || event.srcElement;
    var index;
    var action;
    var timeInput;
    var startAt;

    if (!target || !target.tagName || target.tagName.toLowerCase() !== 'button') {
      return;
    }

    index = parseInt(target.getAttribute('data-index'), 10);
    action = target.getAttribute('data-action');
    if (isNaN(index) || !devices[index]) {
      return;
    }

    if (action === 'start') {
      timeInput = devicesList.querySelector('input[data-action="time"][data-index="' + index + '"]');
      startAt = timeInput ? timeInputToIso(timeInput.value) : null;
      if (timeInput && timeInput.value && !startAt) {
        setMessage(deviceMessage, 'Gio bat dau chua dung. Hay nhap dang HH:mm.', false);
        return;
      }
      devices[index].started_at = startAt || toIso(nowMs());
      if (timeInput) {
        timeInput.value = '';
      }
      if (devicesOnline && devices[index].id !== null && typeof devices[index].id !== 'undefined') {
        saveDeviceStartOnline(index);
      } else {
        saveLocal(deviceStorageKey, devices, deviceMessage);
        renderDevices();
        setMessage(deviceMessage, 'Da bat dau moc 24 gio.', true);
      }
    } else if (action === 'delete') {
      if (devicesOnline) {
        deleteDeviceOnline(index);
      } else {
        devices.splice(index, 1);
        saveLocal(deviceStorageKey, devices, deviceMessage);
        renderDevices();
        setMessage(deviceMessage, 'Da xoa thiet bi.', true);
      }
    }
  };

  clearDevicesBtn.onclick = function () {
    if (devicesOnline) {
      clearDevicesOnline();
    } else {
      devices = [];
      saveLocal(deviceStorageKey, [], deviceMessage);
      renderDevices();
      setMessage(deviceMessage, 'Da xoa tat ca thiet bi.', true);
    }
  };

  bindTabs();

  if (linksOnline) {
    loadLinksOnline();
  } else {
    links = linksFromUrls(loadLocal(linkStorageKey, []));
    renderLinks();
    setMessage(linkMessage, 'Link dang luu tren trinh duyet nay.', false);
  }

  if (devicesOnline) {
    loadDevicesOnline();
  } else {
    devices = loadLocal(deviceStorageKey, []);
    renderDevices();
    setMessage(deviceMessage, 'Thiet bi dang luu tren trinh duyet nay.', false);
  }

  window.setInterval(function () {
    var active = document.activeElement;
    if (active && active.className && String(active.className).indexOf('time-input') !== -1) {
      return;
    }
    renderDevices();
  }, 1000);
}());
