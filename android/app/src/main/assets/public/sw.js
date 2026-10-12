/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-b1bafff1'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "recurso-grafico-1024x500.png",
    "revision": "c9b60f60e714000c4bef40d265f1c9b4"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "733660bdd9d0cf2f10c93e55969c1510"
  }, {
    "url": "pwa-512x512.png",
    "revision": "733660bdd9d0cf2f10c93e55969c1510"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9d951e7d19dea435d7fe4eda8bd50691"
  }, {
    "url": "index.html",
    "revision": "4675b75b91d2888f00acb67e6f580fae"
  }, {
    "url": "icon.svg",
    "revision": "428af97208a4471fee7e92715b476323"
  }, {
    "url": "icon-maskable.svg",
    "revision": "874ae796e6fb408c4efebc5eff36926c"
  }, {
    "url": "feature-graphic.png",
    "revision": "c9b60f60e714000c4bef40d265f1c9b4"
  }, {
    "url": "favicon.svg",
    "revision": "428af97208a4471fee7e92715b476323"
  }, {
    "url": "favicon.png",
    "revision": "881564a0f8d417f90801991393740508"
  }, {
    "url": "favicon.ico",
    "revision": "668396bf1e77707603f2e3b71d171d6f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "35d3f8e55611ffd533eb863a281d5ea4"
  }, {
    "url": "app-icon-512x512.png",
    "revision": "00168a60d2301292ee7c0510e8b3e449"
  }, {
    "url": "assets/web-Dvzb1T7N.js",
    "revision": null
  }, {
    "url": "assets/web-CtDhODXo.js",
    "revision": null
  }, {
    "url": "assets/web-CJRgN6tW.js",
    "revision": null
  }, {
    "url": "assets/web-BiCOXD5V.js",
    "revision": null
  }, {
    "url": "assets/web-BPxM4o9Q.js",
    "revision": null
  }, {
    "url": "assets/index-rx25Tmq2.css",
    "revision": null
  }, {
    "url": "assets/index-5nEBjiUw.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "35d3f8e55611ffd533eb863a281d5ea4"
  }, {
    "url": "favicon.ico",
    "revision": "668396bf1e77707603f2e3b71d171d6f"
  }, {
    "url": "favicon.svg",
    "revision": "428af97208a4471fee7e92715b476323"
  }, {
    "url": "icon.svg",
    "revision": "428af97208a4471fee7e92715b476323"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9d951e7d19dea435d7fe4eda8bd50691"
  }, {
    "url": "pwa-512x512.png",
    "revision": "733660bdd9d0cf2f10c93e55969c1510"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "733660bdd9d0cf2f10c93e55969c1510"
  }, {
    "url": "manifest.webmanifest",
    "revision": "29315c2e056f507369b17a274cc25c5d"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/covers\.openlibrary\.org\/.*/i, new workbox.StaleWhileRevalidate({
    "cacheName": "openlibrary-covers-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
