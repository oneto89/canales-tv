(function () {
  'use strict';

  var storageKey = 'canales-tv-playlist-url';
  var favoritesKey = 'canales-tv-favorites';
  var lastChannelKey = 'canales-tv-last-channel-url';
  var channels = [];
  var guidePrograms = {};
  var guideReady = false;
  var guideRefreshTimer = 0;
  var favorites = loadFavorites();
  var selected = 0;
  var playingIndex = -1;
  var playbackRequestId = 0;
  var playerOpen = false;
  var settingsWasOpen = false;
  var channelListOpen = false;
  var favoriteOnly = false;
  var optionsReturnToChannelList = false;
  var optionsFavoriteTargetIndex = -1;
  var returnToChannelListAfterSettings = false;
  var menuSelection = 0;
  var rail = document.getElementById('channelRail');
  var settings = document.getElementById('settings');
  var playbackMenu = document.getElementById('playbackMenu');
  var exitDialog = document.getElementById('exitDialog');
  var exitNoButton = document.getElementById('exitNo');
  var exitYesButton = document.getElementById('exitYes');
  var input = document.getElementById('playlistUrl');
  var message = document.getElementById('settingsMessage');
  var toastNode = document.getElementById('toast');
  var favoritesBar = document.getElementById('favoritesBar');
  var nowPlayingBanner = document.getElementById('nowPlayingBanner');
  var toastTimer = 0;
  var overlayTimer = 0;
  var overlayMode = '';
  var favoriteBarSelection = 0;
  var exitSelection = 0;

  function loadFavorites() {
    try {
      var saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (e) { return []; }
  }

  function saveFavorites() {
    try { localStorage.setItem(favoritesKey, JSON.stringify(favorites)); } catch (e) { /* Storage may be unavailable. */ }
  }

  function isFavorite(channel) {
    return !!channel && favorites.indexOf(channel.url) !== -1;
  }

  function visibleChannelIndices() {
    var indices = [];
    for (var i = 0; i < channels.length; i++) {
      if (!favoriteOnly || isFavorite(channels[i])) indices.push(i);
    }
    return indices;
  }

  function moveSelection(step) {
    var indices = visibleChannelIndices();
    if (!indices.length) return;
    var position = indices.indexOf(selected);
    if (position < 0) position = step > 0 ? -1 : 0;
    position = (position + step + indices.length) % indices.length;
    selected = indices[position];
  }

  function toast(text) {
    toastNode.textContent = text;
    toastNode.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastNode.classList.add('hidden'); }, 3200);
  }

  function clearOverlayTimer() {
    clearTimeout(overlayTimer);
    overlayTimer = 0;
    overlayMode = '';
  }

  function scheduleOverlayClose(mode) {
    clearOverlayTimer();
    overlayMode = mode;
    overlayTimer = setTimeout(function () {
      if (mode === 'channels') setChannelListOpen(false);
      else if (mode === 'favorites') closeFavoritesBar();
      else if (mode === 'options') setOptionsOpen(false, false);
      else if (mode === 'info') document.body.classList.remove('info-panel-open');
      clearOverlayTimer();
    }, 10000);
  }

  function closeFavoritesBar() {
    favoritesBar.classList.add('hidden');
    document.body.classList.remove('favorites-open');
    if (overlayMode === 'favorites') clearOverlayTimer();
  }

  function showInfoPanel() {
    closeFavoritesBar();
    setChannelListOpen(false);
    setOptionsOpen(false, false);
    nowPlayingBanner.textContent = 'Estás viendo ' + channels[selected].name;
    document.body.classList.add('info-panel-open');
    scheduleOverlayClose('info');
  }

  function renderFavoritesBar() {
    favoritesBar.innerHTML = '<div class="favorites-title">FAVORITOS</div>';
    var favoriteChannels = channels.filter(isFavorite);
    if (!favoriteChannels.length) {
      var empty = document.createElement('div');
      empty.className = 'favorite-empty';
      empty.textContent = 'Todavía no agregas canales favoritos.';
      favoritesBar.appendChild(empty);
      return;
    }
    if (favoriteBarSelection >= favoriteChannels.length) favoriteBarSelection = 0;
    favoriteChannels.forEach(function (channel, position) {
      var tile = document.createElement('div');
      tile.className = 'favorite-tile' + (position === favoriteBarSelection ? ' selected' : '');
      tile.setAttribute('data-favorite-position', position);
      var logo = safeImage(channel.logo);
      if (logo) {
        var image = document.createElement('img');
        image.src = logo;
        image.alt = '';
        tile.appendChild(image);
      } else {
        var fallback = document.createElement('strong');
        fallback.textContent = channel.name.substring(0, 3).toUpperCase();
        tile.appendChild(fallback);
      }
      var name = document.createElement('span');
      name.textContent = channel.name;
      tile.appendChild(name);
      favoritesBar.appendChild(tile);
    });
  }

  function showFavoritesBar() {
    document.body.classList.remove('info-panel-open');
    setChannelListOpen(false);
    setOptionsOpen(false, false);
    var favoriteChannels = channels.filter(isFavorite);
    var activeUrl = channels[playingIndex] ? channels[playingIndex].url : (channels[selected] ? channels[selected].url : '');
    var activePosition = favoriteChannels.findIndex(function (channel) { return channel.url === activeUrl; });
    if (activePosition >= 0) favoriteBarSelection = activePosition;
    else if (favoriteBarSelection >= favoriteChannels.length) favoriteBarSelection = 0;
    renderFavoritesBar();
    favoritesBar.classList.remove('hidden');
    document.body.classList.add('favorites-open');
    scheduleOverlayClose('favorites');
  }

  function openSettings() {
    settingsWasOpen = true;
    settings.classList.remove('hidden');
    input.value = localStorage.getItem(storageKey) || '';
    message.textContent = 'Se guardará en este televisor.';
    setTimeout(function () { input.focus(); }, 50);
  }

  function closeSettings() {
    settings.classList.add('hidden');
    settingsWasOpen = false;
    if (returnToChannelListAfterSettings && playerOpen) {
      returnToChannelListAfterSettings = false;
      setChannelListOpen(true);
    } else {
      returnToChannelListAfterSettings = false;
      document.getElementById('settingsButton').focus();
    }
  }

  function setPlaybackMode(active) {
    document.documentElement.classList.toggle('playback-active', active);
    document.body.classList.toggle('playback-active', active);
  }

  function setChannelListOpen(open) {
    if (open) {
      closeFavoritesBar();
      document.body.classList.remove('info-panel-open');
    }
    channelListOpen = open;
    document.body.classList.toggle('channel-list-open', open);
    if (open) {
      if (playingIndex >= 0 && (!favoriteOnly || isFavorite(channels[playingIndex]))) selected = playingIndex;
      var visible = visibleChannelIndices();
      if (visible.indexOf(selected) === -1 && visible.length) selected = visible[0];
      updateRailSelection(true);
    } else if (playerOpen) {
      document.body.focus();
    }
    if (open) scheduleOverlayClose('channels');
    else if (overlayMode === 'channels') clearOverlayTimer();
  }

  function getMenuButtons() {
    return Array.prototype.slice.call(playbackMenu.querySelectorAll('button[data-action]'));
  }

  function setOptionsOpen(open, restoreList) {
    if (open) {
      closeFavoritesBar();
      document.body.classList.remove('info-panel-open');
      optionsReturnToChannelList = channelListOpen;
      optionsFavoriteTargetIndex = channelListOpen && channels[selected] ? selected : (playingIndex >= 0 ? playingIndex : selected);
      setChannelListOpen(false);
      playbackMenu.classList.remove('hidden');
      document.body.classList.add('options-open');
      updateFavoriteActionLabel();
      menuSelection = 0;
      var firstButton = getMenuButtons()[menuSelection];
      if (firstButton) firstButton.focus();
      scheduleOverlayClose('options');
      return;
    }
    playbackMenu.classList.add('hidden');
    document.body.classList.remove('options-open');
    if (restoreList && optionsReturnToChannelList && playerOpen) setChannelListOpen(true);
    optionsReturnToChannelList = false;
    if (overlayMode === 'options') clearOverlayTimer();
  }

  function showExitDialog() {
    exitDialog.classList.remove('hidden');
    exitSelection = 0;
    exitNoButton.classList.add('selected');
    exitYesButton.classList.remove('selected');
    exitNoButton.focus();
  }

  function closeExitDialog() {
    exitDialog.classList.add('hidden');
    document.body.focus();
  }

  function confirmExit() {
    if (exitSelection === 0) {
      closeExitDialog();
      return;
    }
    stopPlayback();
    try {
      if (window.tizen && tizen.application) tizen.application.getCurrentApplication().exit();
      else closeExitDialog();
    } catch (e) {
      closeExitDialog();
    }
  }

  function getFavoriteTargetIndex() {
    if (!playbackMenu.classList.contains('hidden')) return optionsFavoriteTargetIndex;
    if (channelListOpen && selected >= 0 && channels[selected]) return selected;
    return playingIndex >= 0 ? playingIndex : selected;
  }

  function updateFavoriteActionLabel() {
    var button = document.getElementById('favoriteAction');
    var index = getFavoriteTargetIndex();
    button.textContent = isFavorite(channels[index]) ? 'Favorito  ✓' : 'Favorito';
  }

  function toggleFavorite(index) {
    if (typeof index !== 'number') index = getFavoriteTargetIndex();
    var channel = channels[index];
    if (!channel) { toast('Selecciona un canal primero.'); return; }
    var favoriteAt = favorites.indexOf(channel.url);
    if (favoriteAt === -1) {
      favorites.push(channel.url);
      toast('Agregado a favoritos: ' + channel.name);
    } else {
      favorites.splice(favoriteAt, 1);
      toast('Quitado de favoritos: ' + channel.name);
      if (favoriteOnly) {
        var remaining = visibleChannelIndices();
        if (!remaining.length) favoriteOnly = false;
        else if (remaining.indexOf(selected) === -1) selected = remaining[0];
      }
    }
    saveFavorites();
    render();
    if (channelListOpen) updateRailSelection(true);
  }

  function runMenuAction(action) {
    var restoreList = optionsReturnToChannelList;
    var favoriteTarget = optionsFavoriteTargetIndex;
    setOptionsOpen(false, action === 'favorite' && restoreList);
    if (action === 'channels') {
      favoriteOnly = false;
      render();
      if (playerOpen) setChannelListOpen(true);
      else {
        var selectedItem = rail.querySelector('.rail-item.selected');
        if (selectedItem) selectedItem.focus();
      }
    } else if (action === 'playlist') {
      returnToChannelListAfterSettings = playerOpen;
      openSettings();
    } else if (action === 'stop') {
      setChannelListOpen(false);
      stopPlayback();
      var idleSelection = rail.querySelector('.rail-item.selected');
      if (idleSelection) idleSelection.focus();
    } else if (action === 'close' && playerOpen) {
      document.body.focus();
    } else if (action === 'favorite') {
      toggleFavorite(favoriteTarget);
      updateFavoriteActionLabel();
    } else if (action === 'favorites') {
      favoriteOnly = true;
      var favoriteIndices = visibleChannelIndices();
      if (favoriteIndices.indexOf(selected) === -1 && favoriteIndices.length) selected = favoriteIndices[0];
      render();
      if (playerOpen) setChannelListOpen(true);
      else updateRailSelection(true);
      if (!favoriteIndices.length) toast('Aún no tienes canales favoritos.');
    }
  }

  function parseM3U(text) {
    var result = [];
    var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    var pending = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf('#EXTINF:') === 0) {
        var name = line.substring(line.lastIndexOf(',') + 1).trim() || 'Canal';
        var group = (line.match(/group-title="([^"]*)"/i) || [])[1] || 'TV';
        var logo = (line.match(/tvg-logo="([^"]*)"/i) || [])[1] || '';
        var channelId = (line.match(/tvg-id="([^"]*)"/i) || [])[1] || '';
        pending = { name: name, group: group, logo: logo, id: channelId };
      } else if (line.charAt(0) !== '#' && pending) {
        pending.url = line;
        result.push(pending);
        pending = null;
      }
    }
    return result;
  }

  function safeImage(url) {
    return /^https?:\/\//i.test(url || '') ? url : '';
  }

  function normalizeGuideName(value) {
    return String(value || '').toLowerCase()
      .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
      .replace(/\b(chile|cl)\b/g, ' ').replace(/\b(uhd|fhd|hd|sd|4k)\b/g, ' ')
      .replace(/[^a-z0-9]/g, '');
  }

  function findGuideProgram(channel) {
    if (!channel || !guideReady) return null;
    var keys = [normalizeGuideName(channel.name), normalizeGuideName(channel.id)];
    for (var i = 0; i < keys.length; i++) {
      if (guidePrograms[keys[i]]) return guidePrograms[keys[i]];
      if (keys[i] === 'chv' && guidePrograms.chilevision) return guidePrograms.chilevision;
      if (keys[i] === '13' && guidePrograms.canal13) return guidePrograms.canal13;
      if (keys[i] === '13c' && guidePrograms.canal13c) return guidePrograms.canal13c;
    }
    return null;
  }

  function readNodeText(parent, selector) {
    var node = parent ? parent.querySelector(selector) : null;
    return node ? String(node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function loadGuideSchedule() {
    var offset = new Date().getTimezoneOffset() * -1;
    var url = isLocalPreview ? '/_mi_tv_guide?offset=' + offset : 'https://mi.tv/cl/async/guide/all/' + offset;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 20000;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300 || !xhr.responseText) {
        guideReady = true;
        updateGuideOverlay();
        return;
      }
      try {
        var holder = document.createElement('div');
        holder.innerHTML = xhr.responseText;
        var rows = holder.querySelectorAll('.channel');
        var parsed = {};
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          var channelLink = row.querySelector('a.c');
          var channelName = readNodeText(channelLink, 'h3') || (channelLink && channelLink.querySelector('img') ? channelLink.querySelector('img').getAttribute('alt') : '');
          var key = normalizeGuideName(channelName);
          if (!key) continue;
          var broadcasts = row.querySelectorAll('.broadcasts li');
          var currentIndex = 0;
          for (var j = 0; j < broadcasts.length; j++) {
            if ((' ' + broadcasts[j].className + ' ').indexOf(' ongoing ') !== -1) { currentIndex = j; break; }
          }
          var current = broadcasts.length ? broadcasts[currentIndex] : null;
          var next = broadcasts.length > currentIndex + 1 ? broadcasts[currentIndex + 1] : null;
          var slug = channelLink ? String(channelLink.getAttribute('href') || '').split('/').pop() : '';
          parsed[key] = {
            name: channelName,
            current: { time: readNodeText(current, '.time'), title: readNodeText(current, '.title'), subtitle: readNodeText(current, '.sub-title') },
            next: { time: readNodeText(next, '.time'), title: readNodeText(next, '.title') }
          };
          if (slug) parsed[normalizeGuideName(slug)] = parsed[key];
        }
        guidePrograms = parsed;
        guideReady = true;
        updateGuideOverlay();
      } catch (error) {
        guideReady = true;
        updateGuideOverlay();
      }
    };
    xhr.onerror = function () { guideReady = true; updateGuideOverlay(); };
    xhr.ontimeout = function () { guideReady = true; updateGuideOverlay(); };
    xhr.send();
    if (!guideRefreshTimer) guideRefreshTimer = setInterval(loadGuideSchedule, 30 * 60 * 1000);
  }

  function render() {
    var railHadFocus = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('rail-item');
    rail.innerHTML = '';
    if (!channels.length) {
      document.body.classList.remove('has-channels');
      rail.innerHTML = '<div class="rail-item selected" tabindex="0" role="button">M3U</div>';
      document.getElementById('selectedChannelCard').style.display = 'none';
      document.getElementById('guidePanel').style.display = 'none';
      return;
    }
    document.body.classList.add('has-channels');
    document.getElementById('selectedChannelCard').style.display = '';
    document.getElementById('guidePanel').style.display = '';
    var visible = visibleChannelIndices();
    if (!visible.length) {
      rail.innerHTML = '<div class="rail-empty" tabindex="0">Aún no tienes canales favoritos.<br><span>Abre Opciones para agregar el canal actual.</span></div>';
      return;
    }
    for (var v = 0; v < visible.length; v++) {
      var i = visible[v];
      var channel = channels[i];
      var item = document.createElement('div');
      item.className = 'rail-item' + (i === selected ? ' selected' : '');
      item.tabIndex = i === selected ? 0 : -1;
      item.setAttribute('role', 'button');
      item.setAttribute('data-index', i);
      item.innerHTML = '<span class="rail-num">' + String(i + 1) + '</span>';
      if (safeImage(channel.logo)) {
        var img = document.createElement('img');
        img.src = safeImage(channel.logo);
        img.alt = '';
        img.onerror = function () { this.style.display = 'none'; };
        item.appendChild(img);
      } else {
        var initials = document.createElement('span');
        initials.className = 'rail-logo-fallback';
        initials.textContent = channel.name.substring(0, 3).toUpperCase();
        item.appendChild(initials);
      }
      var label = document.createElement('span');
      label.className = 'rail-name';
      label.textContent = channel.name;
      item.appendChild(label);
      if (isFavorite(channel)) {
        var star = document.createElement('span');
        star.className = 'favorite-star';
        star.textContent = '★';
        item.appendChild(star);
      }
      rail.appendChild(item);
    }
    updateRailSelection(railHadFocus);
  }

  function updateRailSelection(focusSelected) {
    var items = rail.querySelectorAll('.rail-item[data-index]');
    var selectedItem = null;
    for (var i = 0; i < items.length; i++) {
      var isSelected = Number(items[i].getAttribute('data-index')) === selected;
      items[i].classList.toggle('selected', isSelected);
      items[i].tabIndex = isSelected ? 0 : -1;
      if (isSelected) selectedItem = items[i];
    }
    updateGuideOverlay();
    if (selectedItem && focusSelected) {
      selectedItem.focus();
    }
    if (selectedItem) {
      var selectedTop = selectedItem.offsetTop - rail.offsetTop;
      var desiredTop = Math.round(window.innerHeight * 0.578);
      rail.scrollTop = Math.max(0, Math.min(selectedTop - desiredTop, rail.scrollHeight - rail.clientHeight));
    }
  }

  function updateGuideOverlay() {
    var channel = channels[selected];
    var card = document.getElementById('selectedChannelCard');
    var panel = document.getElementById('guidePanel');
    if (!channel) {
      card.style.display = 'none';
      panel.style.display = 'none';
      return;
    }
    card.style.display = '';
    panel.style.display = '';
    document.getElementById('selectedChannelNumber').textContent = String(selected + 1);
    document.getElementById('selectedChannelName').textContent = channel.name;
    var logo = document.getElementById('selectedChannelLogo');
    var fallback = document.getElementById('selectedChannelFallback');
    var logoUrl = safeImage(channel.logo);
    if (logoUrl) {
      logo.src = logoUrl;
      logo.style.display = 'block';
      fallback.style.display = 'none';
    } else {
      logo.removeAttribute('src');
      logo.style.display = 'none';
      fallback.textContent = channel.name.substring(0, 3).toUpperCase();
      fallback.style.display = 'grid';
    }
    var schedule = findGuideProgram(channel);
    document.getElementById('guideEyebrow').textContent = 'AHORA' + (schedule && schedule.current.time ? ' · ' + schedule.current.time : '');
    document.getElementById('guideTitle').textContent = schedule && schedule.current.title ? schedule.current.title : (guideReady ? 'Programación no disponible' : 'Cargando programación…');
    document.getElementById('guideSubtitle').textContent = schedule && schedule.current.subtitle ? schedule.current.subtitle : (schedule ? 'Programación de mi.tv' : (guideReady ? 'mi.tv no tiene datos para este canal' : 'Guía de TV de Chile · mi.tv'));
    var nextText = schedule && schedule.next.title ? 'A continuación' + (schedule.next.time ? ' · ' + schedule.next.time : '') + '  ' + schedule.next.title : 'A continuación: sin datos disponibles';
    document.getElementById('guideNext').textContent = nextText;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; });
  }

  function stopPlayback() {
    playbackRequestId++;
    try {
      if (window.webapis && window.webapis.avplay) {
        var state = window.webapis.avplay.getState();
        if (state !== 'NONE') window.webapis.avplay.close();
      }
    } catch (e) { /* player was already idle */ }
    setPlaybackMode(false);
    playerOpen = false;
    playingIndex = -1;
  }

  function stopForBackground() {
    if (!playerOpen && playingIndex < 0) return;
    stopPlayback();
    clearOverlayTimer();
    closeFavoritesBar();
    setChannelListOpen(false);
    document.body.classList.remove('info-panel-open');
    playbackMenu.classList.add('hidden');
    document.body.classList.remove('options-open');
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopForBackground();
  });
  window.addEventListener('pagehide', stopForBackground);

  function playChannel(index, silentOverlay) {
    if (!channels[index]) return;
    selected = index;
    try { localStorage.setItem(lastChannelKey, channels[index].url); } catch (e) { /* Storage may be unavailable. */ }
    if (silentOverlay) {
      closeFavoritesBar();
      setChannelListOpen(false);
      setOptionsOpen(false, false);
      clearOverlayTimer();
      document.body.classList.remove('info-panel-open');
      nowPlayingBanner.textContent = '';
    } else showInfoPanel();
    updateRailSelection(false);
    if (!window.webapis || !window.webapis.avplay) {
      toast('La reproducción necesita un televisor Samsung Tizen.');
      return;
    }
    stopPlayback();
    var requestId = playbackRequestId;
    setPlaybackMode(true);
    var av = window.webapis.avplay;
    var url = channels[index].url;
    try {
      av.open(url);
      av.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
      av.setDisplayRect(0, 0, 1920, 1080);
      av.setListener({
        onbufferingstart: function () { /* Keep the overlay limited to the channel name. */ },
        onbufferingcomplete: function () {
          if (requestId !== playbackRequestId) return;
          try {
            var tracks = av.getTotalTrackInfo();
            var hasVideo = tracks.some(function (track) { return track.type === 'VIDEO'; });
            if (!hasVideo) toast('Este canal no entrega una pista de video.');
          } catch (e) { /* Older TV firmware may not expose track details. */ }
        },
        onstreamcompleted: function () {
          if (requestId !== playbackRequestId) return;
          setPlaybackMode(false); playerOpen = false; playingIndex = -1; toast('La transmisión terminó.');
        },
        onerror: function (error) {
          if (requestId !== playbackRequestId) return;
          setPlaybackMode(false);
          playerOpen = false;
          playingIndex = -1;
          toast('Error AVPlay: ' + (error && error.message ? error.message : String(error || 'desconocido')));
        }
      });
      // Mark the stream as current while AVPlay prepares it so rapid remote
      // presses continue to use the playback controls instead of idle browsing.
      playerOpen = true;
      playingIndex = index;
      av.prepareAsync(function () {
        if (requestId !== playbackRequestId) return;
        try { av.play(); playerOpen = true; }
        catch (e) { setPlaybackMode(false); playerOpen = false; playingIndex = -1; toast('La TV no pudo iniciar este formato de video.'); }
      }, function () {
        if (requestId !== playbackRequestId) return;
        setPlaybackMode(false); playerOpen = false; playingIndex = -1; toast('La TV no pudo abrir este stream.');
      });
    } catch (e) {
      setPlaybackMode(false);
      playerOpen = false;
      playingIndex = -1;
      toast('La TV no pudo abrir este stream.');
    }
  }

  function loadPlaylist(url, resumeLastChannel) {
    if (!/^https?:\/\//i.test(url)) {
      message.textContent = 'Escribe una dirección http o https válida.';
      return;
    }
    message.textContent = 'Descargando y leyendo la lista…';
    var xhr = new XMLHttpRequest();
    var isLocalPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    var requestUrl = isLocalPreview ? '/_proxy?url=' + encodeURIComponent(url) : url;
    xhr.open('GET', requestUrl, true);
    xhr.timeout = 20000;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) {
        message.textContent = 'El servidor respondió HTTP ' + xhr.status + '.';
        return;
      }
      var found = parseM3U(xhr.responseText || '');
      if (!found.length) {
        message.textContent = 'No se encontraron canales M3U reproducibles en esta lista.';
        return;
      }
      if (playerOpen) stopPlayback();
      returnToChannelListAfterSettings = false;
      channels = found;
      favorites = favorites.filter(function (favoriteUrl) {
        return found.some(function (channel) { return channel.url === favoriteUrl; });
      });
      saveFavorites();
      selected = 0;
      if (resumeLastChannel) {
        var lastChannelUrl = localStorage.getItem(lastChannelKey);
        var lastChannelIndex = found.findIndex(function (channel) { return channel.url === lastChannelUrl; });
        if (lastChannelIndex >= 0) selected = lastChannelIndex;
      }
      favoriteOnly = false;
      localStorage.setItem(storageKey, url);
      document.getElementById('playlistName').textContent = 'Lista cargada';
      closeSettings();
      render();
      guideReady = false;
      guidePrograms = {};
      loadGuideSchedule();
      toast(found.length + ' canales cargados');
      if (resumeLastChannel) playChannel(selected, true);
    };
    xhr.onerror = function () { message.textContent = 'No se pudo acceder a la lista. Revisa la conexión o sus permisos CORS.'; };
    xhr.ontimeout = function () { message.textContent = 'La lista tardó demasiado en responder.'; };
    xhr.send();
  }

  document.getElementById('settingsButton').addEventListener('click', openSettings);
  document.getElementById('saveSettings').addEventListener('click', function () { loadPlaylist(input.value.trim()); });
  document.getElementById('cancelSettings').addEventListener('click', closeSettings);
  playbackMenu.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (button) {
      clearOverlayTimer();
      runMenuAction(button.getAttribute('data-action'));
    }
  });
  exitNoButton.addEventListener('click', function () {
    exitSelection = 0;
    closeExitDialog();
  });
  exitYesButton.addEventListener('click', function () {
    exitSelection = 1;
    confirmExit();
  });
  favoritesBar.addEventListener('click', function (event) {
    if (event.target === favoritesBar) return;
    var tile = event.target.closest('.favorite-tile[data-favorite-position]');
    if (tile) {
      var favoriteChannels = channels.filter(isFavorite);
      var channel = favoriteChannels[Number(tile.getAttribute('data-favorite-position'))];
      if (channel) {
        closeFavoritesBar();
        playChannel(channels.indexOf(channel));
      }
    }
  });
  rail.addEventListener('click', function (event) {
    var node = event.target.closest('.rail-item[data-index]');
    if (node) {
      var wasPlaying = playerOpen;
      playChannel(Number(node.getAttribute('data-index')));
      if (wasPlaying) setChannelListOpen(false);
    }
  });

  function updateClock() {
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();
    document.getElementById('clock').textContent = (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
  }
  updateClock();
  setInterval(updateClock, 30000);

  try {
    if (window.tizen && tizen.tvinputdevice) {
      tizen.tvinputdevice.registerKey('ChannelUp');
      tizen.tvinputdevice.registerKey('ChannelDown');
    }
  } catch (e) { /* Channel keys may already be registered by the TV. */ }

  document.addEventListener('keydown', function (event) {
    var key = event.keyCode;
    var keyName = event.key || '';
    var isDown = key === 40 || key === 65364 || keyName === 'ArrowDown' || keyName === 'Down';
    var isUp = key === 38 || key === 65362 || keyName === 'ArrowUp' || keyName === 'Up';
    var isChannelDown = key === 428 || keyName === 'ChannelDown' || keyName === 'CH_DOWN';
    var isChannelUp = key === 427 || keyName === 'ChannelUp' || keyName === 'CH_UP';
    var isBack = key === 8 || key === 27 || key === 10009 || keyName === 'Escape' || keyName === 'Back';
    if (!settings.classList.contains('hidden')) {
      var cancelButton = document.getElementById('cancelSettings');
      var saveButton = document.getElementById('saveSettings');
      var active = document.activeElement;
      if (isBack) {
        closeSettings();
        event.preventDefault();
      } else if (isDown && active === input) {
        cancelButton.focus();
        event.preventDefault();
      } else if (isUp && (active === cancelButton || active === saveButton)) {
        input.focus();
        event.preventDefault();
      } else if (key === 39 && active === cancelButton) {
        saveButton.focus();
        event.preventDefault();
      } else if (key === 37 && active === saveButton) {
        cancelButton.focus();
        event.preventDefault();
      } else if (key === 13 && active === saveButton) {
        loadPlaylist(input.value.trim());
        event.preventDefault();
      } else if (key === 13 && active === cancelButton) {
        closeSettings();
        event.preventDefault();
      }
      return;
    }
    if (!exitDialog.classList.contains('hidden')) {
      if (isBack) closeExitDialog();
      else if (key === 37 || key === 39 || isUp || isDown) {
        exitSelection = exitSelection === 0 ? 1 : 0;
        exitNoButton.classList.toggle('selected', exitSelection === 0);
        exitYesButton.classList.toggle('selected', exitSelection === 1);
        (exitSelection === 0 ? exitNoButton : exitYesButton).focus();
      } else if (key === 13) confirmExit();
      event.preventDefault();
      return;
    }
    if (overlayMode) scheduleOverlayClose(overlayMode);
    if (isChannelUp || isChannelDown) {
      if (!channels.length) return;
      closeFavoritesBar();
      setChannelListOpen(false);
      setOptionsOpen(false, false);
      document.body.classList.remove('info-panel-open');
      var channelStep = isChannelDown ? 1 : -1;
      selected = playingIndex >= 0 ? playingIndex : selected;
      moveSelection(channelStep);
      playChannel(selected);
      event.preventDefault();
      return;
    }
    if (playbackMenu.classList.contains('hidden') === false) {
      var menuButtons = getMenuButtons();
      if (isBack) {
        setOptionsOpen(false, true);
        event.preventDefault();
      } else if (key === 37 || key === 39) {
        var direction = key === 39 ? 1 : -1;
        menuSelection = (menuSelection + direction + menuButtons.length) % menuButtons.length;
        if (menuButtons[menuSelection]) menuButtons[menuSelection].focus();
        event.preventDefault();
      } else if (key === 13) {
        if (menuButtons[menuSelection]) menuButtons[menuSelection].click();
        event.preventDefault();
      }
      return;
    }
    if (document.body.classList.contains('favorites-open')) {
      var favoriteTiles = favoritesBar.querySelectorAll('.favorite-tile');
      if (isBack) {
        closeFavoritesBar();
        event.preventDefault();
      } else if ((key === 37 || key === 39) && favoriteTiles.length) {
        var favoriteStep = key === 39 ? 1 : -1;
        favoriteBarSelection = (favoriteBarSelection + favoriteStep + favoriteTiles.length) % favoriteTiles.length;
        renderFavoritesBar();
        event.preventDefault();
      } else if (key === 13 && favoriteTiles.length) {
        var favoriteChannels = channels.filter(isFavorite);
        var favoriteChannel = favoriteChannels[favoriteBarSelection];
        if (favoriteChannel) {
          closeFavoritesBar();
          playChannel(channels.indexOf(favoriteChannel));
        }
        event.preventDefault();
      }
      return;
    }
    if (playerOpen) {
      if (isBack) {
        if (channelListOpen) setChannelListOpen(false);
        else showExitDialog();
        event.preventDefault();
        return;
      }
      if (channelListOpen) {
        if (isDown || isUp) {
          moveSelection(isDown ? 1 : -1);
          updateRailSelection(true);
          event.preventDefault();
        } else if (key === 13) {
          if (visibleChannelIndices().indexOf(selected) !== -1 && channels[selected]) {
            playChannel(selected);
            setChannelListOpen(false);
          } else toast('Aún no tienes canales favoritos.');
          event.preventDefault();
        }
        return;
      }
      if (isUp) {
        showFavoritesBar();
        event.preventDefault();
      } else if (isDown) {
        setOptionsOpen(true, false);
        event.preventDefault();
      } else if (key === 39) {
        setChannelListOpen(true);
        event.preventDefault();
      } else if (key === 37) {
        event.preventDefault();
      } else if (key === 13) {
        event.preventDefault();
      }
      return;
    }
    var activeIsSettings = document.activeElement === document.getElementById('settingsButton');
    var activeIsRail = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('rail-item');
    if (isUp) {
      if (!activeIsSettings && channels.length) showFavoritesBar();
      event.preventDefault();
    }
    else if (isDown) {
      if (!activeIsSettings && channels.length) setOptionsOpen(true, false);
      event.preventDefault();
    }
    else if (key === 13) {
      if (activeIsSettings) openSettings();
      else if (playerOpen) stopPlayback();
      else playChannel(selected);
      event.preventDefault();
    }
    else if (isBack) {
      if (!channels.length || settingsWasOpen) openSettings();
      event.preventDefault();
    }
    else if (key === 37) event.preventDefault();
    else if (key === 39 && channels.length) { setChannelListOpen(true); event.preventDefault(); }
  });

  var isLocalPreview = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  var previewDemo = isLocalPreview && (new URLSearchParams(location.search).get('demo') === '1' || location.pathname === '/tv-preview');
  if (previewDemo && (new URLSearchParams(location.search).get('tv') === '1' || location.pathname === '/tv-preview')) document.documentElement.classList.add('preview-tv');
  if (previewDemo) {
    channels = [
      { name: 'TVN', group: 'Nacional', url: 'preview://tvn' },
      { name: 'Mega', group: 'Nacional', url: 'preview://mega' },
      { name: 'Chilevisión', group: 'Nacional', url: 'preview://chv' },
      { name: 'Canal 13', group: 'Nacional', url: 'preview://canal13' },
      { name: 'La Red', group: 'Nacional', url: 'preview://lared' },
      { name: 'TVN 3', group: 'Retro', url: 'preview://tvn3' },
      { name: '13 Rec', group: 'Retro', url: 'preview://13rec' },
      { name: 'Retro Plus', group: 'Retro', url: 'preview://retroplus' },
      { name: 'UChile TV', group: 'Cultura', url: 'preview://uchile' },
      { name: 'Zapping Music', group: 'Música', url: 'preview://music' }
    ];
    selected = 3;
    document.getElementById('playlistName').textContent = 'Vista previa · 10 canales';
    render();
    loadGuideSchedule();
  } else {
    render();
  }
  var saved = localStorage.getItem(storageKey);
  if (previewDemo) {
    settings.classList.add('hidden');
  } else if (saved) {
    document.getElementById('playlistName').textContent = 'Cargando lista guardada…';
    loadPlaylist(saved, true);
  } else {
    setTimeout(openSettings, 350);
  }
}());
