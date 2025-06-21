import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from "vite-plugin-fs";
import basicSsl from '@vitejs/plugin-basic-ssl'
import dotenv from 'dotenv';

dotenv.config();

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        fs(),
        basicSsl(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico'],
            manifest: {
                name: 'Lullgo - Baby Monitor App',
                short_name: 'Lullgo',
                description: 'Baby Monitor App',
                theme_color: '#000000',
                icons: [
                    {
                        src: "pwa-64x64.png",
                        sizes: "64x64",
                        type: "image/png"
                    },
                    {
                        src: "pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: "pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png"
                    },
                    {
                        src: "maskable-icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable"
                    }
                ]
            },
            strategies: 'generateSW',
            injectRegister: 'auto',
            devOptions: {
                enabled: true
            },
            workbox: {
                importScripts: ['push.js']
            }
        }),
    ],
    define: {
        'process.env': process.env,
    },
})
