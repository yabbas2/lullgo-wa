self.addEventListener('push', (event) => {
    console.log('Push event received: ', event);
    const payload = event.data?.json() || { title: 'New Notification', body: '' };
    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            tag: Date.now().toString(),
            data: {
                url: "/",
            },
        })
    );
});
