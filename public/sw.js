if(!self.define){let e,n={};const s=(s,a)=>(s=new URL(s+".js",a).href,n[s]||new Promise((n=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=n,document.head.appendChild(e)}else e=s,importScripts(s),n()})).then((()=>{let e=n[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(a,i)=>{const t=e||("document"in self?document.currentScript.src:"")||location.href;if(n[t])return;let c={};const r=e=>s(e,t),o={module:{uri:t},exports:c,require:r};n[t]=Promise.all(a.map((e=>o[e]||r(e)))).then((e=>(i(...e),c)))}}define(["./workbox-4754cb34"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/app-build-manifest.json",revision:"dc582a8678859b5ed3059d702ff98934"},{url:"/_next/static/VDpyUOG9YBw_vnjnEw4SE/_buildManifest.js",revision:"337746cfc89c74f7f6dc1e9fa52010bd"},{url:"/_next/static/VDpyUOG9YBw_vnjnEw4SE/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/chunks/156-916c6309b1f2d077.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/1684-513d91f5ae8a98eb.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/1840.6032bd605e0a144a.js",revision:"6032bd605e0a144a"},{url:"/_next/static/chunks/294.e72d2554be082393.js",revision:"e72d2554be082393"},{url:"/_next/static/chunks/3568-dca09be2e817f7f7.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/4935-e17cc73a4ae76496.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/4bd1b696-95dc27be1cccfad9.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/4e6af11a-e0b598e0e1a1554e.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/6420.f0175650ce1b605d.js",revision:"f0175650ce1b605d"},{url:"/_next/static/chunks/6513-55d30d2ecf4fe8a8.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/6766-a3885130463857f1.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/6874-9a85614faaf36084.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/8332-25c983f0979f326f.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/8e1d74a4-787c68ce929c78e4.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/9641-07a6729f30e37e13.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(protected)/agent/page-b477708b81364d55.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(protected)/layout-8f53492b6dcaa5ec.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(protected)/page-81fc009e901d0985.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(protected)/profile/page-9f7a5333edf69f3c.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(protected)/tour/%5Bid%5D/page-d5a6de9f617e2902.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(public)/layout-62663e54e579c62f.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/(public)/login/page-1abab1ad0fc4fda0.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/_not-found/page-594d49dc32ea5548.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/actions/route-c07e2fccf8c9eca8.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/audio-guide/fetch-existing/route-4b8f743f9c5051b7.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/audio-guide/generate/%5Bid%5D/route-b872935e83768861.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/audio-guide/route-513418fb393a5ea8.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/connect/route-cbdb37e208193746.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/content-generation/route-4adeae6e44856adb.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/echo/route-9bfb129b5836305e.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/health/route-cf2f34ac0cf1b1af.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/poi-audio/%5Bid%5D/route-5aa3fce02d4a753c.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/poi-knowledge/route-8f03047b5910161d.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/supabase-function/route-885abb84c31dd72e.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/text-to-speech/route-f78308a6040062de.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/tours/%5Bid%5D/route-88c850256a3e91e7.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/api/tours/route-b41554f992358a9f.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/auth/callback/route-d2fbe12ce1d120ea.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/auth/login/page-cfc65abc05d65ea9.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/auth/signup/page-03ff3a6cb7ca79d8.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/layout-218a9ec12b19f8de.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/map-test/page-200e31a17387bc99.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/saved-tours/page-be8248dd875d4b2a.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/app/view-tour/%5Bid%5D/page-2c5180aa4de8af63.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/d50e61c5-d7fb4a7ba2f9d35b.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/framework-dcd2c1f5d9432bec.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/main-app-a0d528fc5c043d15.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/main-bff109ab3a8807ca.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/pages/_app-eb694f3fd49020c8.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/pages/_error-2b3482c094a540b4.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-4ee671ef11eb9be8.js",revision:"VDpyUOG9YBw_vnjnEw4SE"},{url:"/_next/static/css/78bb80e51c071ee3.css",revision:"78bb80e51c071ee3"},{url:"/_next/static/media/26a46d62cd723877-s.woff2",revision:"befd9c0fdfa3d8a645d5f95717ed6420"},{url:"/_next/static/media/55c55f0601d81cf3-s.woff2",revision:"43828e14271c77b87e3ed582dbff9f74"},{url:"/_next/static/media/581909926a08bbc8-s.woff2",revision:"f0b86e7c24f455280b8df606b89af891"},{url:"/_next/static/media/6d93bde91c0c2823-s.woff2",revision:"621a07228c8ccbfd647918f1021b4868"},{url:"/_next/static/media/97e0cb1ae144a2a9-s.woff2",revision:"e360c61c5bd8d90639fd4503c829c2dc"},{url:"/_next/static/media/a34f9d1faa5f3315-s.p.woff2",revision:"d4fe31e6a2aebc06b8d6e558c9141119"},{url:"/_next/static/media/df0a9ae256c0569c-s.woff2",revision:"d54db44de5ccb18886ece2fda72bdfe0"},{url:"/address_location_globe_placeholder_icon_179006.ico",revision:"2f270147d529aba9bb25399c62ae13ff"},{url:"/custom-sw.js",revision:"2b6f976b6d364973161ca3da46f70ea9"},{url:"/earth-globe-global-svgrepo-com.svg",revision:"e3a58777d761d0cda83b7e02b2841010"},{url:"/favicon.ico",revision:"2f270147d529aba9bb25399c62ae13ff"},{url:"/file.svg",revision:"d09f95206c3fa0bb9bd9fefabfd0ea71"},{url:"/globe.svg",revision:"2aaafa6a49b6563925fe440891e32717"},{url:"/js/network-check.js",revision:"a7e9d0561909f1b3ef8737f66f75e7da"},{url:"/manifest.json",revision:"5981cdc37493bd75c0805a5c08bc2b53"},{url:"/next.svg",revision:"8e061864f388b47f33a1c3780831193e"},{url:"/offline.html",revision:"e0a0dc5f388bdb4f3c19862c4ce9dd1f"},{url:"/placeholder-poi.jpg",revision:"d41d8cd98f00b204e9800998ecf8427e"},{url:"/vercel.svg",revision:"c0af2f507b369b085b35ef4bbe3bcf1e"},{url:"/window.svg",revision:"a2760511c65806022ad20adf74370ff3"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:n,event:s,state:a})=>n&&"opaqueredirect"===n.type?new Response(n.body,{status:200,statusText:"OK",headers:n.headers}):n}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;const n=e.pathname;return!n.startsWith("/api/auth/")&&!!n.startsWith("/api/")}),new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;return!e.pathname.startsWith("/api/")}),new e.NetworkFirst({cacheName:"others",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>!(self.origin===e.origin)),new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")}));
