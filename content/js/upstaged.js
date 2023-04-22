const upstaged = (function() {
	showdownJs = 'js/showdown.js';
	prettifyJs = 'js/prettify.js';

	const blocks = [];
	const defaultMdHolderSelector = () => { return document.querySelector("body") };
	let mdHolder;
	let markdownContent;
	let pathPrefix = "";
	const scripts = [
		showdownJs,
		prettifyJs
	];
	const styles = [];

	let afterRender = function() {};
	let isRendered =  false;
	let onPrettifyJsLoaded = function() {};

	const plugins = {
		gist: (gistId, element) => {
			const callbackName = "gist_callback";
			window[callbackName] = function (gistData) {
				
				delete window[callbackName];
				const html = '<link rel="stylesheet" href="' + gistData.stylesheet + '"></link>';
				html += gistData.div;

				const gistContainer = document.createElement('div');
				gistContainer.innerHTML = html;

				element.parentNode.replaceChild(gistContainer, element);
			};

			const script = document.createElement("script");
			script.setAttribute("src", "https://gist.github.com/" + gistId + ".json?callback=" + callbackName);
			document.body.appendChild(script);
		}
	}
	
	return {
		/*
			Many of these attributes are now left empty but are configurable from the html, e.g.
			upstaged.run({
				afterRender: function() {
				  document.title = "Dexygen: Occasionally Profound";
				},
				pathPrefix: "../content-genr/upstaged/"
			});
			
			upstaged.scripts will always need showdown.js, this block can be augmented in the
			configuration passed to run as follows:
			
			scripts: (function() {
				return (scripts.push('example.js'), scripts);
			})()
		*/

		run: function (options) {
			for (const option in options) {
				upstaged[option] = options[option];
			}

			let mdHolderSelector = upstaged?.option?.mdHolderSelector || defaultMdHolderSelector;
			// Load the article
			mdHolder = mdHolderSelector();

			// Save the markdown for after we load the parser
			markdownContent = mdHolder.innerHTML;

			// Empty the content in case it takes a while to parse the markdown (leaves a blank screen)
			mdHolder.innerHTML = '<div class="spinner"></div>';

			let stylePath, scriptPath; // Prepend pathPrefix to these, if it exists
			
			// Load styles first
			for (let i = styles.length - 1; i >= 0; i--) {
				stylePath = pathPrefix ? pathPrefix + styles[i] : styles[i];
				loadStyle(stylePath);
			}

			for (let i = scripts.length - 1; i >= 0; i--) {
				let script = scripts[i];
				let isShowdownJs = script === showdownJs;
				let isPrettify = script === prettifyJs;
				
				scriptPath = pathPrefix ? pathPrefix + scripts[i] : scripts[i];
				showdownJs = isShowdownJs ? scriptPath : showdownJs;
				prettifyJs = isPrettify ? scriptPath : prettifyJs;
				
				loadScript(scriptPath);
			}
		}
	}

	function loadBlock(file, selector) {
		ajax(file, function(html) {
			if( ! html) {
				html = 'error loading ' + file;
			}

			if(selector.substring(0,1) == '.') {
				// IE 8+ = document.querySelector(selector);
				const el = document.getElementsByClassName(selector.substring(1))[0];
			} else {
				const el = document.getElementsByTagName(selector)[0];
			}

			const e = document.createElement('div');
			e.innerHTML = html;
			while(e.firstChild) { el.appendChild(e.firstChild); }
		});
	};

	function loadScript(src) {
		const s = document.createElement('script');
		
		s.type = 'text/javascript';
		s.async = true;
		s.src = src;
		s.onload = (function() {
			if (src === prettifyJs) {
				if (upstaged.isRendered)  {
					prettyPrint();
				}
				else {
					upstaged.onPrettifyJsLoaded = function() {prettyPrint()};
				}
			}
			else if (src === showdownJs) {
				render(markdownContent);
				isRendered = true;
				onPrettifyJsLoaded();
				afterRender();					
			}
		});
		
		const head = document.getElementsByTagName('head')[0].appendChild(s);
	};

	function loadStyle(href, media) {
		const s = document.createElement('link');
		s.type = 'text/css';
		s.media = media || 'all';
		s.rel = 'stylesheet';
		s.href = href;
		const head = document.getElementsByTagName('head')[0];
		head.appendChild(s);
	};

	function traverseChildNodes(node) {
		let next;

		if (node.nodeType === 1) {

			// (Element node)
			if (node = node.firstChild) {
				do {
					// Recursively call traverseChildNodes on each child node
					next = node.nextSibling;
					traverseChildNodes(node);
				} while(node = next);
			}

		} else if (node.nodeType === 3) {

			// (Text node)
			node.data.replace(/\[(\w+):([^\]]+)\]/g, function(match, plugin, value) {
			
				if(plugins[plugin]) {

					if(value = plugins[plugin](value, node)) {
						if(typeof value === "string") {
							node.data = node.data.replace(match, value);
						} else if(typeof value === "Node") {
							node.parentNode.insertBefore(value, node);
							node.parentNode.removeChild(node);
						}
					}
				}
			});
		}
	}	

	function render(markdownContent) {
		const converter = new Showdown.converter({extensions: ['github', 'prettify', 'table'] });
		const html = converter.makeHtml(markdownContent);
		
		mdHolder.innerHTML = '<div class="wrapper">\
			<main role="main">\
			<article>' + html + '</article>\
			</main>\
		</div>';


		// Find all background images and put them in the right elements
		const images = document.getElementsByTagName('main')[0].getElementsByTagName('img');

		// Put all "background" images in their repective DOM elements
		for (let i = images.length - 1; i >= 0; i--) {
			
			let img = images[i];

			// BG images have the format "_[elementname]"
			if(img.alt.substring(0,1) == '_') {

				// Look for that DOM element
				const el = document.getElementsByTagName(img.alt.substring(1))[0];
				if(el) {

					el.style.backgroundImage = 'url(' + img.src + ')';
					el.className += ' background_image';

					// We don't need this anymore
					img.parentNode.removeChild(img);
				}
			}
		}

		// Load content blocks and inject them where needed
		for (let file in blocks) {
			loadBlock(file, blocks[file]);
		}

		// Allow plugins to process shortcode embeds
		traverseChildNodes(mdHolder);

		// Look for dates in Header elements
		for (const x in {'h2':0,'h3':0,'h4':0,'h5':0}) {
			const headers = document.getElementsByTagName(x);
			for (const i = headers.length - 1; i >= 0; i--) {
				if(Date.parse(headers[i].innerHTML.replace(/(th|st|nd|rd)/g, ''))) {
					headers[i].className += ' date';
				}
			}
		}

		// Set the title for browser tabs (not Search Engines)
		const el = document.getElementsByTagName('h1');
		if(el.length && el[0]) {
			document.title = el[0].innerHTML;
		}
	};
})();