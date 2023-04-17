var upstaged = (function() {
	showdownJs = 'js/showdown.js';
	prettifyJs = 'js/prettify.js';
	
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
				scripts = upstaged.scripts;
				scripts.push('example.js');
				return scripts;
			})()
		*/
		blocks: [],
		scripts: [
			showdownJs,
			prettifyJs
		],
		styles: [],
		pathPrefix: "",
		afterRender: function() {},
		plugins: {
			gist: function(gistId, element){
				var callbackName = "gist_callback";
				window[callbackName] = function (gistData) {
					
					delete window[callbackName];
					var html = '<link rel="stylesheet" href="' + gistData.stylesheet + '"></link>';
					html += gistData.div;

					var gistContainer = document.createElement('div');
					gistContainer.innerHTML = html;

					element.parentNode.replaceChild(gistContainer, element);
				};

				var script = document.createElement("script");
				script.setAttribute("src", "https://gist.github.com/" + gistId + ".json?callback=" + callbackName);
				document.body.appendChild(script);
			}
		},
		traverseChildNodes: function(node) {
			var next;

			if (node.nodeType === 1) {

				// (Element node)
				if (node = node.firstChild) {
					do {
						// Recursively call traverseChildNodes on each child node
						next = node.nextSibling;
						this.traverseChildNodes(node);
					} while(node = next);
				}

			} else if (node.nodeType === 3) {

				// (Text node)
				node.data.replace(/\[(\w+):([^\]]+)\]/g, function(match, plugin, value) {
				
					if(this.plugins[plugin]) {

						if(value = this.plugins[plugin](value, node)) {
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
		},
		isRendered: false,
		onPrettifyJsLoaded: function() {},
		loadScript: function(src) {
			var s = document.createElement('script');
			
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
					upstaged.render(upstaged.markdownContent);
					upstaged.isRendered = true;
					upstaged.onPrettifyJsLoaded();
					upstaged.afterRender();					
				}
			});
			
			var head = document.getElementsByTagName('head')[0].appendChild(s);
		},
		loadStyle: function(href, media) {
			var s = document.createElement('link');
			s.type = 'text/css';
			s.media = media || 'all';
			s.rel = 'stylesheet';
			s.href = href;
			var head = document.getElementsByTagName('head')[0];
			head.appendChild(s);
		},
		loadBlock: function(file, selector) {
			ajax(file, function(html) {
				if( ! html) {
					html = 'error loading ' + file;
				}

				if(selector.substring(0,1) == '.') {
					// IE 8+ = document.querySelector(selector);
					var el = document.getElementsByClassName(selector.substring(1))[0];
				} else {
					var el = document.getElementsByTagName(selector)[0];
				}

				var e = document.createElement('div');
				e.innerHTML = html;
				while(e.firstChild) { el.appendChild(e.firstChild); }
			});
		},
		render: function(markdownContent) {
			var converter = new Showdown.converter({extensions: ['github', 'prettify', 'table'] });
			var html = converter.makeHtml(markdownContent);
			
			this.mdHolder.innerHTML = '<div class="wrapper">\
				<main role="main">\
				<article>' + html + '</article>\
				</main>\
            </div>';


			// Find all background images and put them in the right elements
			var images = document.getElementsByTagName('main')[0].getElementsByTagName('img');

			// Put all "background" images in their repective DOM elements
			for (var i = images.length - 1; i >= 0; i--) {
				
				var img = images[i];

				// BG images have the format "_[elementname]"
				if(img.alt.substring(0,1) == '_') {

					// Look for that DOM element
					var el = document.getElementsByTagName(img.alt.substring(1))[0];
					if(el) {

						el.style.backgroundImage = 'url(' + img.src + ')';
						el.className += ' background_image';

						// We don't need this anymore
						img.parentNode.removeChild(img);
					}
				}
			}

			// Load content blocks and inject them where needed
			for (var file in this.blocks) {
				this.loadBlock(file, this.blocks[file]);
			}

			// Allow plugins to process shortcode embeds
			this.traverseChildNodes(this.mdHolder);

			// Look for dates in Header elements
			for (var x in {'h2':0,'h3':0,'h4':0,'h5':0}) {
				var headers = document.getElementsByTagName(x);
				for (var i = headers.length - 1; i >= 0; i--) {
					if(Date.parse(headers[i].innerHTML.replace(/(th|st|nd|rd)/g, ''))) {
						headers[i].className += ' date';
					}
				}
			}

			// Set the title for browser tabs (not Search Engines)
			var el = document.getElementsByTagName('h1');
			if(el.length && el[0]) {
				document.title = el[0].innerHTML;
			}
		},
		run: function (options) {
			for (var option in options) {
				upstaged[option] = options[option];
			}
			
			// Load the article
			this.mdHolder = document.querySelector(this.mdHolderQuerySel); //document.getElementsByTagName("body")[0];

			// Save the markdown for after we load the parser
			this.markdownContent = this.mdHolder.innerHTML;

			// Empty the content in case it takes a while to parse the markdown (leaves a blank screen)
			this.mdHolder.innerHTML = '<div class="spinner"></div>';

			var stylePath, scriptPath; // Prepend this.pathPrefix to these, if it exists
			
			// Load styles first
			for (var i = this.styles.length - 1; i >= 0; i--) {
				stylePath = this.pathPrefix ? this.pathPrefix + this.styles[i] : this.styles[i];
				this.loadStyle(stylePath);
			}

			for (var i = this.scripts.length - 1; i >= 0; i--) {
				var script = this.scripts[i];
				var isShowdownJs = script === showdownJs;
				var isPrettify = script === prettifyJs;
				
				scriptPath = this.pathPrefix ? this.pathPrefix + this.scripts[i] : this.scripts[i];
				showdownJs = isShowdownJs ? scriptPath : showdownJs;
				prettifyJs = isPrettify ? scriptPath : prettifyJs;
				
				this.loadScript(scriptPath);
			}
			
			// If you want to *see* the pritty AJAX-spinner do this instead...
			//setTimeout(this.fireWhenReady, 1000);
		}
	}
})();