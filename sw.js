const CACHE_NAME = 'elheliehy-platform-v2';
const ASSETS = [
  'index.html',
  'student.html',
  'app.html',
  'manifest.json',
  'app-manifest.json',
  'icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data ? event.notification.data.link : null;
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there is already a window open
      for (const client of clientList) {
        if (client.url.includes('student.html') || client.url.includes('app.html')) {
          return client.focus().then((focusedClient) => {
            if (link) focusedClient.postMessage({ action: 'openLink', url: link });
          });
        }
      }
      // If no window is open, open a new one
      const urlToOpen = link ? `student.html?joinLive=${encodeURIComponent(link)}` : 'student.html';
      return self.clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('message', (event) => {
  // Can be used for worker-to-client notifications if needed
});

// periodicSync background check for notifications
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkNotificationsInBackground());
  }
});

async function checkNotificationsInBackground() {
  try {
    const sessionCache = await caches.open('elheliehy-user-session');
    const response = await sessionCache.match('/session-data');
    if (!response) return;
    const sessionData = await response.json();
    if (!sessionData.SCRIPT_URL || !sessionData.password) return;
    
    // Fetch notifications from SCRIPT_URL
    const body = JSON.stringify({
      action: 'notifications',
      password: sessionData.password,
      deviceId: sessionData.deviceId
    });
    
    const res = await fetch(sessionData.SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const data = await res.json();
    
    if (data && data.notifications) {
      const seenCache = await caches.open('elheliehy-seen-notifs');
      const unreadNotifs = [];
      
      for (const n of data.notifications) {
        const key = n.title + n.date;
        const matched = await seenCache.match('/' + encodeURIComponent(key));
        if (!matched) {
          unreadNotifs.push(n);
        }
      }
      
      if (unreadNotifs.length > 0) {
        for (const n of unreadNotifs) {
          await self.registration.showNotification(n.title, {
            body: n.body,
            icon: 'icon.png',
            vibrate: [200, 100, 200],
            silent: false,
            data: { link: n.link }
          });
          
          // Mark as seen in Cache
          await seenCache.put('/' + encodeURIComponent(n.title + n.date), new Response('1'));
        }
      }
    }

    // 2. Fetch and check weekly schedule for active live classes starting now
    const scheduleBody = JSON.stringify({
      action: 'schedule',
      password: sessionData.password
    });
    const scheduleRes = await fetch(sessionData.SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: scheduleBody
    });
    const scheduleData = await scheduleRes.json();
    
    if (scheduleData && scheduleData.schedule) {
      const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const now = new Date();
      const currentDayStr = arabicDays[now.getDay()];
      const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();
      
      let activeLesson = null;
      for (const item of scheduleData.schedule) {
        if (item.day !== currentDayStr || !item.link) continue;
        
        // Match time format e.g. "4:00 م" or "4:00م"
        const cleanTime = item.time.trim().replace(/([0-9])([مص])/g, '$1 $2').replace(/\s+/g, ' ');
        const timeMatch = cleanTime.match(/(\d+):(\d+)\s*(م|ص)/);
        if (!timeMatch) continue;
        
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3];
        
        if (ampm === "م" && hours < 12) hours += 12;
        if (ampm === "ص" && hours === 12) hours = 0;
        
        const start = hours * 60 + minutes;
        const duration = parseInt(item.duration) || 60;
        
        // Trigger if current time is within class start time and 15 minutes after start
        if (currentMinutesTotal >= start && currentMinutesTotal <= (start + 15)) {
          activeLesson = item;
          break;
        }
      }
      
      if (activeLesson) {
        const alarmKey = `bg_alarm_${currentDayStr}_${activeLesson.time}`;
        const seenCache = await caches.open('elheliehy-seen-notifs');
        const matched = await seenCache.match('/' + encodeURIComponent(alarmKey));
        if (!matched) {
          await self.registration.showNotification("بدء الحصة المباشرة الآن! ⚠️", {
            body: `حصتك المباشرة المجدولة بدأت الآن. انقر هنا للانضمام فوراً.`,
            icon: 'icon.png',
            vibrate: [300, 150, 300, 150, 300, 150, 300],
            requireInteraction: true,
            data: { link: activeLesson.link }
          });
          // Mark this alarm key as notified today
          await seenCache.put('/' + encodeURIComponent(alarmKey), new Response('1'));
        }
      }
    }
  } catch (error) {
    console.error('Error checking notifications/schedule in background:', error);
  }
}
