import fs from 'fs';

self.addEventListener('push', onPush);

async function onPush(event) {
    if (event.data) {
        const data = event.data.json();
        const title = data.title;
        const body = data.body;

        // Send the push data to the application
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage(data));

        const notificationOptions = {
            body: body,
            tag: Date.now().toString(),
            icon: fs.readSync("logo.png"),
            data: {
                url: "/",
            },
        };

        await event.waitUntil(
            self.registration.showNotification(title, notificationOptions),
        );
    }
}
