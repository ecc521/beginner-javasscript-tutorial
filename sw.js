self.importScripts("allPages.js") //Defines self.order

function messageAllClients(message) {
return self.clients.matchAll().then(clients => {
  clients.forEach(client => client.postMessage(message));
})
}



const cacheName = "beginner-javascript-tutorial"

//Array of items to try and preload on install (the serviceWorker will install without them preloaded). Can be exact or relative to serviceWorker scope
const preloadList = [
    "editor.html",
    "allPages.js",
	"codemirror-5.42.0/lib/codemirror.js",
	"codemirror-5.42.0/lib/codemirror.css",
	"codemirror-5.42.0/mode/htmlmixed/htmlmixed.js",
	"codemirror-5.42.0/mode/xml/xml.js",
	"codemirror-5.42.0/mode/javascript/javascript.js",
	"codemirror-5.42.0/mode/css/css.js"
]


function rebaseURL(url) {
    //Fills in relative URLs using the serviceWorker scope
    return (new URL(url, registration.scope)).href
}

//Add pages in self.order to preloadList
self.order.forEach(arr => {preloadList.push(arr[0])})


async function preload() {
    const cache = await caches.open(cacheName)
    let requests = []
    for (let index in preloadList) {
        let url = rebaseURL(preloadList[index])
        requests.push(fetch(url))
    }
    for (let index in requests) {
        let request = requests[index]
        try {
            let response = await request
            await cache.put(response.url, response)
        }
        catch(e) {
            console.error(e)
        }
    }
}

//Make sure something has changed since the data was last cached.
async function checkForChanges() {
    const cache = await caches.open(cacheName)
    let url = "https://api.github.com/repos/ecc521/beginner-javascript-tutorial/commits/master"

    let oldResponse = await caches.match(url)
    let oldHash;
    if (oldResponse) {
        oldHash = (await oldResponse.json()).sha
    }

    let latestCommit = await fetch(url)
    await cache.put(url, latestCommit.clone())
    let hash = (await latestCommit.json()).sha

    if (hash !== oldHash) {
        console.log("Tutorial has changed since data was cached. Updating data in cache.")
        await preload()
    }
}

checkForChanges() //Updates cache to the latest version.




//Milliseconds to wait for network response before using cache
//When set to 0, cached data will be returned immediately, and cache will be updated in background.
const defaultWaitPeriod = 1200


function fetchHandler(event) {
    event.respondWith((async function(){
		let waitperiod = defaultWaitPeriod

        let cache = await caches.open(cacheName)

        let url = event.request.url

        let fromcache = await caches.match(url)

		//These files should never change. If they do, the codemirror version will change. This should improve performance and
		//reduce usage of bandwidth.
		if (url.includes("codemirror-5.42.0") && fromcache) {
			messageAllClients(url + " served from cache.")
			return fromcache
		}

		let fromnetwork = fetch(event.request)

        if (!fromcache) {
            //No cache. All we can do is return network response
            let response = await fromnetwork
            await cache.put(url, response.clone())
            return response
        }
        else {

            //We have cached data
            return new Promise(function(resolve, reject){

				let served = 0

                //If the fetch event fails (ex. offline), return cached immediately
                fromnetwork.catch(function(e){
					messageAllClients(url + " errored. Using cache.")
					if (!served) {
						served = 1
						resolve(fromcache)
					}
                })

				//Fetch from network and update cache
                fromnetwork.then(function(response){
					let otherServed = served
					served = 1
                    cache.put(url, response.clone()).then(() => {
						if (otherServed) {
							messageAllClients("Updated cache for " + url)
						}
						else {
							messageAllClients(url + " has been loaded from the network")
						}
						resolve(response)
					})
                })


                    //If the network doesn't respond quickly enough, use cached data
                    setTimeout(function(){
						if (!served) {
							served = 1
                        	messageAllClients(url + " took too long to load from network. Using cache")
							resolve(fromcache)
						}
                    }, waitperiod)
                })
            }
    }()))
}

self.addEventListener("fetch", fetchHandler)
