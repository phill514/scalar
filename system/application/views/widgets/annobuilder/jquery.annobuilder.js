/**
 * Scalar    
 * Copyright 2013 The Alliance for Networking Visual Culture.
 * http://scalar.usc.edu/scalar
 * Alliance4NVC@gmail.com
 *
 * Licensed under the Educational Community License, Version 2.0 
 * (the "License"); you may not use this file except in compliance 
 * with the License. You may obtain a copy of the License at
 * 
 * http://www.osedu.org/licenses /ECL-2.0 
 * 
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.       
 */  

/**
 * @projectDescription		The AnnoBuilder plug-in enables users to annotate media files in Scalar.
 *							Scalar is a project of The Alliance for Networking Visual Culture (http://scalar.usc.edu).
 * @author					Erik Loyer
 * @version					2.0
 */

jQuery.fn.annobuilder = function(options) {
	return this.each(function() {

		var element = $(this);

		$.annobuilder.model.init(element, options);
		var the_test = $.annobuilder.controller.init();
		$('body').bind('mediaElementReady', the_test);

		if ($.annobuilder.model.isTesting) console.log(options);

	});
};

/**
 * jQuery.fn.sortElements
 * --------------
 * @param Function comparator:
 *   Exactly the same behaviour as [1,2,3].sort(comparator)
 *   
 * @param Function getSortable
 *   A function that should return the element that is
 *   to be sorted. The comparator will run on the
 *   current collection, but you may want the actual
 *   resulting sort to occur on a parent or another
 *   associated element.
 *   
 *   E.g. $('td').sortElements(comparator, function(){
 *      return this.parentNode; 
 *   })
 *   
 *   The <td>'s parent (<tr>) will be sorted instead
 *   of the <td> itself.
 *
 * http://james.padolsey.com/javascript/sorting-elements-with-jquery/
 */
jQuery.fn.sortElements = (function(){
 
    var sort = [].sort;
 
    return function(comparator, getSortable) {
 
        getSortable = getSortable || function(){return this;};
 
        var placements = this.map(function(){
 
            var sortElement = getSortable.call(this),
                parentNode = sortElement.parentNode,
 
                // Since the element itself will change position, we have
                // to have some way of storing its original position in
                // the DOM. The easiest way is to have a 'flag' node:
                nextSibling = parentNode.insertBefore(
                    document.createTextNode(''),
                    sortElement.nextSibling
                );
 
            return function() {
 
                if (parentNode === this) {
                    throw new Error(
                        "You can't sort elements if any one is a descendant of another."
                    );
                }
 
                // Insert before flag:
                parentNode.insertBefore(this, nextSibling);
                // Remove flag:
                parentNode.removeChild(nextSibling);
 
            };
 
        });
 
        return sort.call(this, comparator).each(function(i){
            placements[i].call(getSortable.call(this));
        });
 
    };
 
})();

/**
 * Model object for the annobuilder.
 * @constructor
 */
jQuery.AnnoBuilderModel = function() {

	this.element = null;					// the html element the builder should appear in
	this.mediaElement = null;				// the media element containing the media being annotated
	this.base_dir = null;					// url of the current book
	this.path = null;						// path to the media file
	this.node = null;						// node representing the media file
	this.annotations = [];					// array of annotations
	this.selectedAnnotation = null;			// currently selected annotation
	this.lastSelectedURL = null;			// uri of the last selected annotation
	this.isTesting = false;					// are we in testing mode?
	this.mediaSource = null;				// describes the source type of the media file

	/**
	 * Initializes the model.
	 *
	 * @param {Object} element		The element the builder should appear in.
	 * @param {Object} options		Configuration options.
	 */
	jQuery.AnnoBuilderModel.prototype.init = function(element, options) {

		this.element = element;
		this.mediaElement = options.link.data('mediaelement');

		// set testing flag
		if (window.location.href.indexOf('testing') != -1) {
			$.annobuilder.model.isTesting = true;
			console.log('isTesting');
		} else {
			$.annobuilder.model.isTesting = false;
		}

	}

	/**
	 * Sets up the model (runs after media element is fully ready).
	 */
	jQuery.AnnoBuilderModel.prototype.setup = function() {

		this.base_dir = this.mediaElement.model.base_dir;
		this.path = this.mediaElement.model.path;
		this.meta = this.mediaElement.model.meta;
		this.filename = this.mediaElement.model.filename;
		this.extension = this.mediaElement.model.extension;
		this.mediaSource = this.mediaElement.model.mediaSource;

	}

	/**
	 * Returns the annotation which matches the specified uri.
	 *
	 * @param {String} uri		The uri to match.
	 * @return					The matching annotation.
	 */
	jQuery.AnnoBuilderModel.prototype.getAnnotationFromURL = function(url) {

		var result;
		var annotation;
		var i;
		var n = this.annotations.length;
		for (i=0; i<n; i++) {
			annotation = this.annotations[i];
			//console.log('compare: '+annotation.body.url+' '+url);
			if ((annotation.body.url == url) && (annotation.type == scalarapi.model.relationTypes.annotation)) {
				result = annotation;
				break;
			}
		}

		return result;
	}

}

/**
 * Controller object for the annobuilder.
 * @constructor
 */
jQuery.AnnoBuilderController = function() {

	var me = this;

	/**
	 * Initializes the controller.
	 */
	jQuery.AnnoBuilderController.prototype.init = function() {
		$.annobuilder.model.setup();
		me.setup();
	}

	/**
	 * Sets up the controller.
	 */
	jQuery.AnnoBuilderController.prototype.setup = function() {
		this.loadAnnotations();
		$.annobuilder.view.setup();
	}

	/**
	 * Loads annotations for the media file.
	 */
	jQuery.AnnoBuilderController.prototype.loadAnnotations = function() {
		if (scalarapi.loadCurrentPage(true, this.handleAnnotations, null, 1, false, 'annotation') == 'loaded') this.handleAnnotations();
	}

	/**
	 * Handles loaded annotation data.
	 *
	 * @param {Object} json		JSON data comprising the media metadata.
	 */
	jQuery.AnnoBuilderController.prototype.handleAnnotations = function(json) {

		$.annobuilder.model.node = scalarapi.model.nodesByURL[scalarapi.model.urlPrefix+$.annobuilder.model.meta.substr(scalarapi.model.urlPrefix.length)];
		$.annobuilder.model.annotations = $.annobuilder.model.node.getRelations('annotation', 'incoming');

		if ($.annobuilder.view.builder != null) {
			$.annobuilder.view.builder.buildList();
			$.annobuilder.view.builder.sortAnnotations();
			
			// if a new annotation was just created, find it and select it
			if ($.annobuilder.view.builder.newAnnotationURL) {
				var annotation = $.annobuilder.model.getAnnotationFromURL($.annobuilder.view.builder.newAnnotationURL);
				if (annotation) {
					$.annobuilder.controller.selectAnnotation(annotation);
				}
				$.annobuilder.view.builder.newAnnotationURL = null;
				
			// if no annotation was selected, then select the top one
			} else if (!$.annobuilder.model.selectedAnnotation) {
				$.annobuilder.controller.selectAnnotation();
			} 
		}
		
	}

	/**
	 * Adds the specified annotation to the model.
	 *
	 * @param {Object} annotation	The annotation to be added.
	 */
	jQuery.AnnoBuilderController.prototype.addAnnotation = function(annotation) {
		$.annobuilder.model.annotations.push(annotation);
	}

	/**
	 * Selects the specified annotation.
	 *
	 * @param {Object} annotation		The annotation to be selected.
	 */
	jQuery.AnnoBuilderController.prototype.selectAnnotation = function(annotation) {

		// select the specified annotation
		if (annotation != null) {
			$.annobuilder.model.lastSelectedURL = annotation.body.url;
			$.annobuilder.model.selectedAnnotation = annotation;
			$.annobuilder.view.builder.update();
			
		// otherwise, select the top-most annotation (if there is one)
		} else {
			if ($.annobuilder.model.annotations.length > 0) {
				setTimeout(function() {
					$.annobuilder.controller.selectAnnotation($.annobuilder.view.builder.annotationList.find('.annotationChip').eq(0).data('annotation'));
				}, 1000);
			}
		}

	}

}

/**
 * View object for the annobuilder.
 * @constructor
 */
jQuery.AnnoBuilderView = function() {

	this.builder = null;			// View for the actual builder interface

	/**
	 * Intializes the master view.
	 */
	jQuery.AnnoBuilderView.prototype.setup = function(json) {

		// create the interface view that we need
		switch ($.annobuilder.model.mediaSource.contentType) {

			case "audio":
			case "video":
			case "image":
			this.builder = new $.AnnoBuilderInterfaceView();
			break;
			
			case "document":
			if ($.annobuilder.model.mediaSource.name == 'PlainText') {
				this.container = $('<div class="annobuilderWarning">To create a new annotation for this text file, click the "New" button below and follow the annotation instructions in the "Relationships" section.</div>');
			} else {
				this.container = $('<div class="annobuilderWarning">This type of media cannot be annotated in Scalar.</div>');
			}
			$($.annobuilder.model.element).html(this.container);
			break;
			
			default:
			this.container = $('<div class="annobuilderWarning">This type of media cannot be annotated in Scalar.</div>');
			$($.annobuilder.model.element).html(this.container);
			break;

		}

		if (this.builder) this.builder.setup();

	}
	
	/**
	 * Shortens the specified string to the given character length, adding a [continued]
	 * if any shortening actually occurs.
	 *
	 * @param {String} string		The string to be shortened.
	 * @param {Number} maxChars		Desired character length of the string (not including '[continued]')
	 * @return						The modified string.
	 */
	jQuery.AnnoBuilderView.prototype.shorten = function(string, maxChars) {
	
		var result;
		if (string == null) {
			string = '';
			result = '';
		} else {
			result = string.substr(0, 70);
		}
		if (string.length > 70) {
			result += '... [continued]';
		}	
			
		return result;	
	}
	
	/**
	 * Converts null strings into empty strings.
	 *
	 * @param {String} string		The null string to be converted to empty.
	 * @return						The converted string (if null) or the original string (if not).
	 */
	jQuery.AnnoBuilderView.prototype.nullToEmpty = function(string) {
		return (string == null) ? '' : string;
	}

}

/**
 * View for annotation editor interface.
 * @constructor
 */
jQuery.AnnoBuilderInterfaceView = function() {

	var me = this;

	this.container = null;						// table container
	this.annotationList = null;					// list of annotations
	this.footerControls = null;					// footer controls
	this.saveRequestCount = 0;					// number of save requests sent
	this.saveResultCount = 0;					// number of save request results received
	this.saveErrorOccurred = false;				// did an error occur during the last save?
	this.propertiesBeingEdited = [];			// array of properties currently being edited
	this.dirtyAnnotations = [];					// array of dirty annotations
	this.newAnnotationURL = null;				// url of the annotation just added
	this.annotatedImage = null;					// storage for the annotated image (if needed)

	/**
	 * Intializes the builder view.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.setup = function() {

		this.container = $('<div class="annotationListContainer"></div>');
		$($.annobuilder.model.element).html(this.container);
		
		var leftColumn = $('<div class="left_column"></div>').appendTo(this.container);
		this.annotationList = $('<div class="annotationList"></div>').appendTo(leftColumn);
		
		var buttonBar = $('<div class="button_bar"><a class="bar_button" href="javascript:;"><img src="'+widgets_uri+'/annobuilder/plus_btn.png" alt="Add" width="13" height="13" /></a><a class="bar_button" href="javascript:;"><img src="'+widgets_uri+'/annobuilder/minus_btn.png" alt="Trash" width="13" height="13" /></a></div>').appendTo(leftColumn);
		buttonBar.find('a').eq(1).click(this.handleDelete);
		buttonBar.find('a').eq(0).click(this.handleAdd);
		
		this.annotationFormMessage = $('<div class="annotationFormMessage">To proceed, select an existing annotation from the list to the left, or create a new one using the plus button.</div>').appendTo(this.container);
		
		this.annotationForm = $('<div class="annotationForm"><table class="form_fields"><tbody></tbody></table></div>').appendTo(this.container);
		this.annotationForm.find('tbody').append('<tr><td class="field">Title</td><td class="value"><input id="annotationTitle" type="text" size="45" onchange="$.annobuilder.view.builder.handleEditTitle()" onkeyup="$.annobuilder.view.builder.handleEditTitle()"/></td></tr>');
		
		switch ($.annobuilder.model.mediaSource.contentType) {
		
			case 'audio':
			case 'video':
			this.annotationForm.find('tbody').append('<tr><td class="field"></td><td class="value">Start: <span id="startTime">00:00:00</span> <a id="setStartTimeBtn" class="generic_button border_radius" style="margin-right:20px;">Set</a> End: <span id="endTime">00:00:00</span> <a id="setEndTimeBtn" class="generic_button border_radius">Set</a></td></tr>');
			break;
			
			case 'image':
			this.annotationForm.find('tbody').append('<tr><td class="field"></td><td class="value">X: <input id="x" type="text" size="6" onchange="$.annobuilder.view.builder.handleEditDimensions()" onkeyup="$.annobuilder.view.builder.handleEditDimensions()"> <select name="xDimType" onchange="$.annobuilder.view.builder.handleEditDimensions()" selectedIndex="1"><option value="percent">%</option><option value="pixels">px</option></select> &nbsp;&nbsp; Y: <input id="y" type="text" size="6" onchange="$.annobuilder.view.builder.handleEditDimensions()" onkeyup="$.annobuilder.view.builder.handleEditDimensions()"> <select name="yDimType" onchange="$.annobuilder.view.builder.handleEditDimensions()" selectedIndex="1"><option value="percent">%</option><option value="pixels">px</option></select></td></tr>');
			this.annotationForm.find('tbody').append('<tr><td class="field"></td><td class="value">W: <input id="width" type="text" size="6" onchange="$.annobuilder.view.builder.handleEditDimensions()" onkeyup="$.annobuilder.view.builder.handleEditDimensions()"> <select name="widthDimType" onchange="$.annobuilder.view.builder.handleEditDimensions()" selectedIndex="1"><option value="percent">%</option><option value="pixels">px</option></select> &nbsp;&nbsp; H: <input id="height" type="text" size="6" onchange="$.annobuilder.view.builder.handleEditDimensions()" onkeyup="$.annobuilder.view.builder.handleEditDimensions()"> <select name="heightDimType" onchange="$.annobuilder.view.builder.handleEditDimensions()" selectedIndex="1"><option value="percent">%</option><option value="pixels">px</option></select></td></tr>');
			break;
		
		}
		
		this.annotationForm.find('tbody').append('<tr><td class="field">Content</td><td class="value"><div class="help_button"><a>?</a><em>The full content of the annotation.</em></div><textarea id="annotationContent" type="text" cols="40" rows="6" onchange="$.annobuilder.view.builder.handleEditContent()" onkeyup="$.annobuilder.view.builder.handleEditContent()"/></td></tr>');
		this.annotationForm.find('tbody').append('<tr><td class="field">Abstract</td><td class="value"><input id="annotationDescription" type="text" size="45" onchange="$.annobuilder.view.builder.handleEditDescription()" onkeyup="$.annobuilder.view.builder.handleEditDescription()"/><div class="help_button"><a>?</a><em>Optional abstract of the annotation that, if entered, will be shown alongside the media instead of the full content above. The full content will be available through an additional link.</em></div></td></tr>');
		$('#setStartTimeBtn').click(this.handleSetStartTime);
		$('#setEndTimeBtn').click(this.handleSetEndTime);
		
		this.footerControls = $('<div class="annotationFooterControls"></div>').appendTo($.annobuilder.model.element);
		$('<div class="annotationInstructions"><p>&nbsp;</p></div>').appendTo($.annobuilder.model.element);
		
		var footerRight = $('<span class="annotationFooterRight"></span>').appendTo(this.footerControls);
		if ($.annobuilder.model.mediaSource.contentType == 'video') {
			var footerLeft = $('<p class="smaller" style="margin-top:7px;">Note: Video annotations are not supported on iOS devices.</p>').appendTo(this.footerControls);
		}
		
		footerRight.append('<div id="spinner_wrapper"></div>');
		
		var saveLink = $('<span id="saveLink"><strong>You have unsaved changes.</strong> <a class="generic_button large default" href="javascript:;">Save</a></span>').appendTo(footerRight);
		saveLink.click(this.handleSave);
		saveLink.css('display', 'none');
		var doneMessage = $('<span id="doneMessage">Your changes were saved.</span>').appendTo(footerRight);
		doneMessage.css('display', 'none');
		
		var doneButton = $('<a class="generic_button large" href="javascript:;">Done</a>').appendTo(footerRight);
		doneButton.click(function() {
			var temp = document.location.href.split('.');
			temp.pop();
			var selfUrl = temp.join('.');
			if ($.annobuilder.view.builder.dirtyAnnotations.length > 0) {
				if (confirm('Are you sure you want to leave the editor? Your unsaved changes will be lost.')) {
					window.location = selfUrl;
				}
			} else {
				window.location = selfUrl;
			}
		});
		
		$(".help_button").click(function() {
			if ($(this).find('em').css('display') == 'none') {
				$(this).find("em").stop(true, true).animate({opacity: "show", left: "20"}, "slow");
			} else {
				$(this).find("em").animate({opacity: "hide", left: "30"}, "fast");
			}
		});
		
		$.annobuilder.view.builder.update();

	}

	/**
	 * Builds the list of annotations.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.buildList = function() {
	
		var me = this;
	
		// preserve any unsaved edits
		var editTracking = {};
		$('.annotationList > .annotationChip').each(function() {
			var edits = $(this).data('edits');
			var annotation = $(this).data('annotation');
			if (edits) {
				editTracking[annotation.body.url] = {annotation:annotation, edits:edits};
			}
		});

		this.annotationList.empty();

		var row;
		var value;
		var editor;
		var annotation;
		var annotationChip;
		var control;
		var edits;
		var i;
		var n = $.annobuilder.model.annotations.length;
		for (i=0; i<n; i++) {
		
			annotation = $.annobuilder.model.annotations[i];
			
			// zebra striping
			((i % 2) == 0) ? stripeType = 'light' : stripeType = 'dark';
			annotationChip =  $('<div class="annotationChip '+stripeType+'"></div>');

			extents = $('<p class="annotationExtents"></p>');
			var link;
			link = $('<a href="javascript:;">'+annotation.startString+annotation.separator+annotation.endString+'</a>').appendTo(extents);

			annotationChip.data('annotation', annotation);
			
			// handle click on annotation in list
			annotationChip.click( function() {
				var annotation = $(this).data('annotation');
				var edits = $(this).data('edits');
				switch ($.annobuilder.model.mediaSource.contentType) {

					case 'video':
					case 'audio':
					if (edits) {
						$.annobuilder.model.mediaElement.seek(edits.start);
					} else {
						$.annobuilder.model.mediaElement.seek(annotation.properties.start);
					}
					break;
					
				}
				// if this annotation is not the currently selected one, then store the current edits
				if (annotation != $.annobuilder.model.selectedAnnotation) {
					$.annobuilder.view.builder.storeEdits();
				}
				$.annobuilder.controller.selectAnnotation(annotation);
			});
			
			// restore unsaved edits
			switch ($.annobuilder.model.mediaSource.contentType) {

				case 'video':
				case 'audio':
				if (editTracking[annotation.body.url]) {
					edits =  editTracking[annotation.body.url].edits;
					annotationChip.data('edits', edits);
					annotationChip.append('<p class="annotationTitle"><a href="javascript:;">'+scalarapi.decimalSecondsToHMMSS(edits.start)+'</a>&nbsp; <strong>'+edits.title+'</strong></p>');
				} else {
					annotationChip.append('<p class="annotationTitle"><a href="javascript:;">'+annotation.startString+'</a>&nbsp; <strong>'+annotation.body.current.title+'</strong></p>');
				}
				break;
				
				case 'image':
				if (editTracking[annotation.body.url]) {
					edits =  editTracking[annotation.body.url].edits;
					annotationChip.data('edits', edits);
					annotationChip.append('<p class="annotationTitle"><a href="javascript:;">X:'+edits.x+' Y:'+edits.y+'</a>&nbsp; <strong>'+edits.title+'</strong></p>');
				} else {
					annotationChip.append('<p class="annotationTitle"><a href="javascript:;">'+annotation.startString+'</a>&nbsp; <strong>'+annotation.body.current.title+'</strong></p>');
				}
				break;
				
			}

			if (this.annotationSidebar) {
				this.annotationSidebar.append(annotationChip);
			}	
			this.annotationList.append(annotationChip);	
				
		}
		
		// spacer so the last item doesn't get hidden by the button bar
		this.annotationList.append('<div style="height:25px"></div>');

		// try to preserve the last selection
		var annotation = $.annobuilder.model.getAnnotationFromURL($.annobuilder.model.lastSelectedURL);
		if (annotation) {
			$.annobuilder.controller.selectAnnotation(annotation);
		}

	}
	
	/**
	 * Parses string data for a spatial annotation and returns an object representing each
	 * element's value and type.
	 *
	 * @param xStr			String representing the x coordinate.
	 * @param yStr			String representing the y coordinate.
	 * @param widthStr		String representing the width.
	 * @param heightStr		String representing the height.
	 * @return				Object encapsulating the dimensions.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.parseDimensions = function(xStr, yStr, widthStr, heightStr) {
	
		var dimensions = {};
			
		if (xStr.charAt(xStr.length - 1) == '%') {
			dimensions.x = parseFloat(xStr.substr(0, xStr.length - 1));
			dimensions.xType = 'percent';
		} else {
			dimensions.x = parseFloat(xStr);
			dimensions.xType = 'pixels';
		}
		
		if (yStr.charAt(yStr.length - 1) == '%') {
			dimensions.y = parseFloat(yStr.substr(0, yStr.length - 1));
			dimensions.yType = 'percent';
		} else {
			dimensions.y = parseFloat(yStr);
			dimensions.yType = 'pixels';
		}
		
		if (widthStr.charAt(widthStr.length - 1) == '%') {
			dimensions.width = parseFloat(widthStr.substr(0, widthStr.length - 1));
			dimensions.widthType = 'percent';
		} else {
			dimensions.width = parseFloat(widthStr);
			dimensions.widthType = 'pixels';
		}
		
		if (heightStr.charAt(heightStr.length - 1) == '%') {
			dimensions.height = parseFloat(heightStr.substr(0, heightStr.length - 1));
			dimensions.heightType = 'percent';
		} else {
			dimensions.height = parseFloat(heightStr);
			dimensions.heightType = 'pixels';
		}
	
		return dimensions;
	}
	
	/**
	 * Unparses form data for a spatial annotation and returns an object containing
	 * the string representations of its dimensions.
	 *
	 * @param edits {Object}			Edited dimensions to be unparsed (if omitted, will operate on current form contents)
	 * @return							Object with string encapsulation of dimensions.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.unparseDimensions = function(edits) {
	
		var dimensions = {};
		
		if (edits) {
			dimensions.x = edits.x;
			dimensions.y = edits.y;
			dimensions.width = edits.width;
			dimensions.height = edits.height;
		} else {
			dimensions.x = $('#x').val().toString();
			if (dimensions.x == '') dimensions.x = '0';
			if ($('select[name=xDimType]')[0].selectedIndex == 0) dimensions.x += '%';
			dimensions.y = $('#y').val().toString();
			if (dimensions.y == '') dimensions.y = '0';
			if ($('select[name=yDimType]')[0].selectedIndex == 0) dimensions.y += '%';
			dimensions.width = $('#width').val().toString();
			if (dimensions.width == '') dimensions.width = '0';
			if ($('select[name=widthDimType]')[0].selectedIndex == 0) dimensions.width += '%';
			dimensions.height = $('#height').val().toString();
			if (dimensions.height == '') dimensions.height = '0';
			if ($('select[name=heightDimType]')[0].selectedIndex == 0) dimensions.height += '%';
		}
		
		dimensions.string = dimensions.x+','+dimensions.y+','+dimensions.width+','+dimensions.height;
		
		return dimensions;
	}
	

	/**
	 * Updates the list of annotations.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.update = function() {
	
		var me = this;
	
		// highlight selected annotation
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			var index = $.annobuilder.view.builder.indexForAnnotation(annotation);
			var row = this.annotationList.find('.annotationChip').eq(index);
			row.addClass('selectedAnnotationRow');

			// update form with contents of selected annotation
			var annotation;
			var isListDirty = false;
			var row;
			$('.annotationList > .annotationChip').each(function() {
				row = $(this);
				annotation = row.data('annotation');
				if ($.annobuilder.view.builder.dirtyAnnotations.indexOf(annotation.id) != -1) isListDirty = true;
				row.removeClass('selectedAnnotationRow');		
				if (annotation == $.annobuilder.model.selectedAnnotation) {
					row.addClass('selectedAnnotationRow');
					var edits = row.data('edits');
					
					switch ($.annobuilder.model.mediaSource.contentType) {

						case 'video':
						case 'audio':
						if (edits) {
							$('#annotationTitle').val(edits.title);
							$('#startTime').text(scalarapi.decimalSecondsToHMMSS(edits.start, true));
							$('#startTime').data('value', edits.start);
							$('#endTime').text(scalarapi.decimalSecondsToHMMSS(edits.end, true));
							$('#endTime').data('value', edits.end);
							$('#annotationDescription').val(edits.description);
							$('#annotationContent').val(edits.content);
						} else {
							$('#annotationTitle').val(annotation.body.current.title);
							$('#startTime').text(scalarapi.decimalSecondsToHMMSS(annotation.properties.start, true));
							$('#startTime').data('value', annotation.properties.start);
							$('#endTime').text(scalarapi.decimalSecondsToHMMSS(annotation.properties.start, true));
							$('#endTime').data('value', annotation.properties.end);
							$('#annotationDescription').val(annotation.body.current.description);
							$('#annotationContent').val(annotation.body.current.content);
						}
						break;
						
						case 'image':
						var dimensions;
						if (edits) {
							$('#annotationTitle').val(edits.title);
							$('#annotationDescription').val(edits.description);
							$('#annotationContent').val(edits.content);
							dimensions = $.annobuilder.view.builder.parseDimensions(edits.x, edits.y, edits.width, edits.height);
							me.showSpatialAnnotation(edits.title, edits);
						} else {
							$('#annotationTitle').val(annotation.body.current.title);
							$('#annotationDescription').val(annotation.body.current.description);
							$('#annotationContent').val(annotation.body.current.content);
							dimensions = $.annobuilder.view.builder.parseDimensions(annotation.properties.x, annotation.properties.y, annotation.properties.width, annotation.properties.height);
							me.showSpatialAnnotation(annotation.body.getDisplayTitle(), annotation.properties);
						}
						$('#x').val(dimensions.x == 0 ? '' : dimensions.x);
						if (dimensions.xType == 'pixels') {
							$('select[name=xDimType]')[0].selectedIndex = 1;
						} else {
							$('select[name=xDimType]')[0].selectedIndex = 0;
						}
						$('#y').val(dimensions.y == 0 ? '' : dimensions.y);
						if (dimensions.yType == 'pixels') {
							$('select[name=yDimType]')[0].selectedIndex = 1;
						} else {
							$('select[name=yDimType]')[0].selectedIndex = 0;
						}
						$('#width').val(dimensions.width == 0 ? '' : dimensions.width);
						if (dimensions.widthType == 'pixels') {
							$('select[name=widthDimType]')[0].selectedIndex = 1;
						} else {
							$('select[name=widthDimType]')[0].selectedIndex = 0;
						}
						$('#height').val(dimensions.height == 0 ? '' : dimensions.height);
						if (dimensions.heightType == 'pixels') {
							$('select[name=heightDimType]')[0].selectedIndex = 1;
						} else {
							$('select[name=heightDimType]')[0].selectedIndex = 0;
						}
						break;
						
					}
				}
			});
			$('.annotationForm').css('display', 'block');
			this.annotationFormMessage.css('display', 'none');
			
			// show appropriate messaging depending on whether there are unsaved changes
			if (isListDirty) {
				this.footerControls.find('#saveLink').css('display', 'inline');
				this.footerControls.find('#doneMessage').css('display', 'none');
			} else {
				this.footerControls.find('#saveLink').css('display', 'none');
			}
			
		} else {
			$('.annotationForm').css('display', 'none');
			this.annotationFormMessage.css('display', 'block');
		}

	}
	
	/**
	 * Displays a spatial annotation with the specified name and dimension data.
	 *
	 * @param name {String}			The name to be displayed with the annotation.
	 * @param data {Object}			The dimensions of the annotation.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.showSpatialAnnotation = function(name, data) {
	
		if ($.annobuilder.model.mediaElement.view.mediaObjectView.hasLoaded) {
		
			var x;
			var y;
			var width;
			var height;
			var notes = [];
			var temp;
			var urn;
				
			var dimensions = this.parseDimensions(data.x, data.y, data.width, data.height);
			var mediaScale = $.annobuilder.model.mediaElement.view.mediaScale;
			var intrinsicDim = $.annobuilder.model.mediaElement.view.intrinsicDim;
	
			if (dimensions.xType == 'percent') {
				x = (dimensions.x * .01) * mediaScale;
				x *= intrinsicDim.x;
			} else {
				x = dimensions.x * mediaScale;
			}
			
			if (dimensions.yType == 'percent') {
				y = (dimensions.y * .01) * mediaScale;
				y *= intrinsicDim.y;
			} else {
				y = dimensions.y * mediaScale;
			}
			
			if (dimensions.widthType == 'percent') {
				width = (dimensions.width * .01) * mediaScale;
				width *= intrinsicDim.x;
			} else {
				width = dimensions.width * mediaScale;
			}
			
			if (dimensions.heightType == 'percent') {
				height = (dimensions.height * .01) * mediaScale;
				height *= intrinsicDim.y;
			} else {
				height = dimensions.height * mediaScale;
			}
			
			notes.push({
				'top': y,
				'left': x,
				'width': width,
				'height': height,
				'text': name,
				'annotation': data,
				'id': 'selectedAnnotation',
				'editable': false
			});
			
			var image = $('.mediaObject > img')[0];
				
				// if annotations are already attached, then remove and then reload them
				if (this.annotatedImage != null) {
					this.annotatedImage.clear();
					this.annotatedImage.updateSize();
					this.annotatedImage.reload(notes);
					
				// otherwise, load for the first time
			} else {
			
	 			this.annotatedImage = $(image).annotateImage({
	 				editable: false,
	 				useAjax: false,
	 				notes: notes,
					ignoreRollover: true
	 			});
	
			}
				
	        $('.image-annotate-view').show();
	 		$($('.image-annotate-area')).show();
	 		$($('.image-annotate-note')).show();
	 		
		}
		
	}
	
	/**
	 * Scrolls to the given annotation.
	 *
	 * @param {Object} annotation		The annotation to scroll to.
	 * @param {Boolean} instant 		Should the scroll be instantaneous?
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.scrollToAnnotation = function(annotation, instant) {
			
		var index = $.annobuilder.view.builder.indexForAnnotation(annotation);
		var scrollTo = this.annotationList.find('.annotationChip').eq(index);
		if (!instant) {
			this.container.animate({
				scrollTop: scrollTo.offset().top - this.container.offset().top + this.container.scrollTop()
			});
		} else {
			this.container.scrollTop(
				scrollTo.offset().top - this.container.offset().top + this.container.scrollTop()
			);
		}
		
	}
	
	/**
	 * Empties the form.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.clearForm = function() {
	
		$('#annotationTitle').val('');
		
		switch ($.annobuilder.model.mediaSource.contentType) {
		
			case 'video':
			case 'audio':
			$('#startTime').text(scalarapi.decimalSecondsToHMMSS(0));
			$('#startTime').data('value', 0);
			$('#endTime').text(scalarapi.decimalSecondsToHMMSS(0));
			$('#endTime').data('value', 0);
			break;
			
			case 'image':
			$('#x').val(0);
			$('#y').val(0);
			$('#width').val(0);
			$('#height').val(0);
			$('input:radio[name=xDimType]')[0].checked = true;
			$('input:radio[name=yDimType]')[0].checked = true;
			$('input:radio[name=widthDimType]')[0].checked = true;
			$('input:radio[name=heightDimType]')[0].checked = true;
			break;
			
		}
		
		$('#annotationDescription').val('');
		$('#annotationContent').val('');
	}

	/**
	 * Handles clicks on the control to update the start time of an annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleSetStartTime = function(event) {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			var seconds = $.annobuilder.model.mediaElement.getCurrentTime();
			me.setStartTime(seconds);
			me.makeSelectedAnnotationDirty();
			me.sortAnnotations();
			me.update();
		}
	}

	/**
	 * Handles clicks on the control to update the end time of an annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleSetEndTime = function(event) {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			var seconds = $.annobuilder.model.mediaElement.getCurrentTime();
			me.setEndTime(seconds);
			me.makeSelectedAnnotationDirty();
			me.sortAnnotations();
			me.update();
		}
	}
	
	/**
	 * Adds the selected annotation to the list of "dirty" annotations.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.makeSelectedAnnotationDirty = function() {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			if ($.annobuilder.view.builder.dirtyAnnotations.indexOf(annotation.id) == -1) {
				$.annobuilder.view.builder.dirtyAnnotations.push(annotation.id);
			}
			this.footerControls.find('#saveLink').css('display', 'inline');
			this.footerControls.find('#doneMessage').css('display', 'none');
		}
		$.annobuilder.view.builder.storeEdits();
	}
	
	/**
	 * Returns the current sort index of the given annotation.
	 *
	 * @param {Object} annotation			The annotation to look for.
	 * @return								The sort index of the annotation.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.indexForAnnotation = function(annotation) {
		var index;
		$('.annotationList > .annotationChip').each(function() {
			if ($(this).data('annotation') == annotation) {
				index = $(this).index();
			}
		});
		return index;
	}

	/**
	 * Handles changes to the title of the selected annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleEditTitle = function(event) {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			var index = $.annobuilder.view.builder.indexForAnnotation(annotation);
			var row = me.annotationList.find('.annotationChip').eq(index);
			row.find('strong').text($('#annotationTitle').val());
			me.scrollToAnnotation(annotation, true);
			me.makeSelectedAnnotationDirty(annotation);
		}
	}

	/**
	 * Handles changes to the description of an annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleEditDescription = function(event) {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			me.makeSelectedAnnotationDirty(annotation);
		}
	}

	/**
	 * Handles changes to the content of an annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleEditContent = function(event) {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			me.makeSelectedAnnotationDirty(annotation);
		}
	}

	/**
	 * Handles changes to the dimensions of a spatial annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleEditDimensions = function(event) {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			me.makeSelectedAnnotationDirty(annotation);
		}	
	}

	/**
	 * Sets the start time to the specified value.
	 *
	 * @param {Number} seconds		The seconds value to store.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.setStartTime = function(seconds) {
		if (seconds != null) {
			var secondsString = scalarapi.decimalSecondsToHMMSS(seconds, true);
			$('#startTime').text(secondsString);
			$('#startTime').data('value', seconds);
			var index = $.annobuilder.view.builder.indexForAnnotation($.annobuilder.model.selectedAnnotation);
			var row = me.annotationList.find('.annotationChip').eq(index);
			row.find('a').text(secondsString);
			if (seconds > $('#endTime').data('value')) this.setEndTime(seconds);
		}
	}

	/**
	 * Sets the end time to the specified value.
	 *
	 * @param {Number} seconds		The seconds value to store.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.setEndTime = function(seconds) {
		if (seconds != null) {
			var secondsString = scalarapi.decimalSecondsToHMMSS(seconds, true);
			$('#endTime').text(secondsString);
			$('#endTime').data('value', seconds);
			if (seconds < $('#startTime').data('value')) this.setStartTime(seconds);
		}
	}

	/**
	 * Sets the title to the specified value.
	 *
	 * @param {Number} title		The title to store.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.setTitle = function(title) {
		if (title != null) {
			this.title = title;
			this.setStatus('dirty');
		}
	}

	/**
	 * Sets the description to the specified value.
	 *
	 * @param {Number} description		The description to store.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.setDescription = function(description) {
		if (description != null) {
			this.description = description;
			this.descriptionPreview = this.description.substr(0, 70);
			if (this.description.length > 70) {
				this.descriptionPreview += '... [continued]';
			}
			this.setStatus('dirty');
		}
	}

	/**
	 * Sets the content to the specified value.
	 *
	 * @param {Number} content		The content to store.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.setContent = function(content) {
		if (content != null) {
			this.content = content;
			this.contentPreview = this.content.substr(0, 70);
			if (this.content.length > 70) {
				this.contentPreview += '... [continued]';
			}
			this.setStatus('dirty');
		}
	}

	/**
	 * Sorts the annotation data by the specified criteria.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.sortAnnotations = function() {
	
		$('.annotationList > .annotationChip').sortElements(function(a, b) {
		
			switch ($.annobuilder.model.mediaSource.contentType) {
			
				case 'video':
				case 'audio':
				var secondsA;
				var secondsB;
				var edits;
				edits = $(a).data('edits');
				if (edits) {
					secondsA = edits.start;
				} else {
					secondsA = $(a).data('annotation').properties.start;
				}
				edits = $(b).data('edits');
				if (edits) {
					secondsB = edits.start;
				} else {
					secondsB = $(b).data('annotation').properties.start;
				}
				return secondsA > secondsB ? 1 : -1;
				break;
				
				case 'image':
				var indexA;
				var indexB;
				edits = $(a).data('edits');
				if (edits) {
					indexA = parseFloat(edits.x) * parseFloat(edits.y);
				} else {
					indexA = parseFloat($(a).data('annotation').properties.x) * parseFloat($(a).data('annotation').properties.y);
				}
				edits = $(b).data('edits');
				if (edits) {
					indexB = parseFloat(edits.x) * parseFloat(edits.y);
				} else {
					indexB = parseFloat($(b).data('annotation').properties.x) * parseFloat($(b).data('annotation').properties.y);
				}
				return indexA > indexB ? 1 : -1;
				break;
				
			}
		});
		
		$('.annotationList > .annotationChip').each(function() {
			var stripeType;
			$(this).removeClass('light');
			$(this).removeClass('dark');
			(($(this).index() % 2) == 0) ? stripeType = 'light' : stripeType = 'dark';
			$(this).addClass(stripeType);
		});

	}
	
	/**
	 * Saves the current annotation's edits to its annotationChip.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.storeEdits = function() {
		var annotation = $.annobuilder.model.selectedAnnotation;
		if (annotation != null) {
			var index = $.annobuilder.view.builder.indexForAnnotation(annotation);
			var row = this.annotationList.find('.annotationChip').eq(index);
			var edits;
			switch ($.annobuilder.model.mediaSource.contentType) {
			
				case 'video':
				case 'audio':
				edits = {
					title: $('#annotationTitle').val(),
					start: $('#startTime').data('value'),
					end: $('#endTime').data('value'),
					description: $('#annotationDescription').val(),
					content: $('#annotationContent').val()
				}
				break;
				
				case 'image':
				var dimensions = $.annobuilder.view.builder.unparseDimensions();
				edits = {
					title: $('#annotationTitle').val(),
					x: dimensions.x,
					y: dimensions.y,
					width: dimensions.width,
					height: dimensions.height,
					description: $('#annotationDescription').val(),
					content: $('#annotationContent').val()
				}
				break;
				
			}
			row.data('edits', edits);
		}
		me.update();
	}

	/**
	 * Shows the spinner animation.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.showSpinner = function(event) {

		if (window['Spinner']) {
			var opts = {
			  lines: 13, // The number of lines to draw
			  length: 4, // The length of each line
			  width: 2, // The line thickness
			  radius: 5, // The radius of the inner circle
			  rotate: 0, // The rotation offset
			  color: '#000', // #rgb or #rrggbb
			  speed: 1, // Rounds per second
			  trail: 60, // Afterglow percentage
			  shadow: false, // Whether to render a shadow
			  hwaccel: false, // Whether to use hardware acceleration
			  className: 'spinner', // The CSS class to assign to the spinner
			  zIndex: 2e9, // The z-index (defaults to 2000000000)
			  top: 'auto', // Top position relative to parent in px
			  right: 'auto' // Left position relative to parent in px
			};
			var target = document.getElementById('spinner_wrapper');
			var spinner = new Spinner(opts).spin(target);
		}

	}

	/**
	 * Hides the spinner animation.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.hideSpinner = function(event) {
		if (window['Spinner']) {
			$('.spinner').remove();
		}
	}

	/**
	 * Handles clicks on the control to delete an annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleDelete = function(event) {
	
		if ($.annobuilder.model.selectedAnnotation) {
		
			var result = confirm('Are you sure you wish to move this annotation to the trash?');
			
			if (result) {
			
				var annotation = $.annobuilder.model.selectedAnnotation;
				
				var baseProperties =  {
					'native': $('input[name="native"]').val(),
					id: $('input[name="id"]').val(),
					api_key: $('input[name="api_key"]').val(),
				};
				
				var pageData = {
					action: 'UPDATE',
					'scalar:urn': annotation.body.current.urn,
					uriSegment: scalarapi.basepath(annotation.body.url),
					'dcterms:title': annotation.body.current.title,
					'dcterms:description': annotation.body.current.description,
					'sioc:content': annotation.body.current.content,
					'rdf:type': 'http://scalar.usc.edu/2012/01/scalar-ns#Composite',
					'scalar:metadata:is_live': 0
				};
				
				var relationData = {};
				
				me.showSpinner();
				
				scalarapi.modifyPageAndRelations(baseProperties, pageData, relationData, function(result) {
					me.hideSpinner();
					if (result) {
						$.annobuilder.model.selectedAnnotation = null;
						$.annobuilder.controller.loadAnnotations();
						$.annobuilder.view.builder.update();
					} else {
						alert('An error occurred while moving the annotation to the trash. Please try again.');
					}
				});
			}
		} else {
			alert('No annotation was selected.');
		}
	}
	
	/**
	 * Handles clicks on the control to add an annotation.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleAdd = function(event) {
		
		var data;
		switch ($.annobuilder.model.mediaSource.contentType) {
		
			case 'video':
			case 'audio':
			var seconds = $.annobuilder.model.mediaElement.getCurrentTime();	
			data = {
				action: 'ADD',
				'native': $('input[name="native"]').val(),
				id: $('input[name="id"]').val(),
				api_key: $('input[name="api_key"]').val(),
				'dcterms:title': 'Annotation',
				'dcterms:description': '',
				'sioc:content': '',
				'rdf:type': 'http://scalar.usc.edu/2012/01/scalar-ns#Composite',
				'scalar:child_urn': $('input[name="scalar:child_urn"]').val(),  /* WARNING: This is actually coming from the comment form, since the annotation form has been replaced ~cd */
				'scalar:child_type': 'http://scalar.usc.edu/2012/01/scalar-ns#Media', 
				'scalar:child_rel': 'annotated',
				'scalar:metadata:start_seconds': seconds,
				'scalar:metadata:end_seconds': seconds + 0.5,
				'scalar:metadata:start_line_num': '',
				'scalar:metadata:end_line_num': '',
				'scalar:metadata:points': ''
			};
			break;
			
			case 'image':
			data = {
				action: 'ADD',
				'native': $('input[name="native"]').val(),
				id: $('input[name="id"]').val(),
				api_key: $('input[name="api_key"]').val(),
				'dcterms:title': 'Annotation',
				'dcterms:description': '',
				'sioc:content': '',
				'rdf:type': 'http://scalar.usc.edu/2012/01/scalar-ns#Composite',
				'scalar:child_urn': $('input[name="scalar:child_urn"]').val(),  /* WARNING: This is actually coming from the comment form, since the annotation form has been replaced ~cd */
				'scalar:child_type': 'http://scalar.usc.edu/2012/01/scalar-ns#Media', 
				'scalar:child_rel': 'annotated',
				'scalar:metadata:start_seconds': '',
				'scalar:metadata:end_seconds': '',
				'scalar:metadata:start_line_num': '',
				'scalar:metadata:end_line_num': '',
				'scalar:metadata:points': '0%,0%,0%,0%'
			};
			break;
			
		}
	
		var success = function(json) {
			me.hideSpinner();
			$.annobuilder.controller.loadAnnotations();
			for (var property in json) { // this should only iterate once
				me.newAnnotationURL = scalarapi.stripVersion(property);
			}
		}
		
		var error = function() {
			me.hideSpinner();
			alert('An error occurred while creating a new annotation. Please try again.');
		}
		
		me.showSpinner();
		
		scalarapi.savePage(data, success, error);
	}

	/**
	 * Handles clicks on the control to save annotation changes.
	 *
	 * @param {Object} event		An object representing the event.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.handleSave = function(event) {

		me.storeEdits();
		
		var i;
		var n = $.annobuilder.model.annotations.length;
		var annotation;
		var index;
		var dataArr = [];
		var pageData;
		var relationArr = [];
		var relationData;
		var baseProperties;
		var row;
		var edits;
		for (i=0; i<n; i++) {
			annotation = $.annobuilder.model.annotations[i];
			index = me.indexForAnnotation(annotation);
			row = me.annotationList.find('.annotationChip').eq(index);
			edits = row.data('edits');
			if (edits) {
				if (annotation.body.url != '') {
					baseProperties =  {
						'native': $('input[name="native"]').val(),
						id: $('input[name="id"]').val(),
						api_key: $('input[name="api_key"]').val(),
					};
					pageData = {
						action: 'UPDATE',
						'scalar:urn': annotation.body.current.urn,
						uriSegment: scalarapi.basepath(annotation.body.url),
						'dcterms:title': edits.title,
						'dcterms:description': edits.description,
						'sioc:content': edits.content,
						'rdf:type': 'http://scalar.usc.edu/2012/01/scalar-ns#Composite'
					};
					relationData = {};
					switch ($.annobuilder.model.mediaSource.contentType) {
					
						case 'video':
						case 'audio':
						relationData['annotation_of'] = {
							action: 'RELATE',
							'scalar:urn': annotation.body.current.urn,
							'scalar:child_urn': $('input[name="scalar:child_urn"]').val(),
							'scalar:child_rel': 'annotated',
							'scalar:metadata:start_seconds': edits.start,
							'scalar:metadata:end_seconds': edits.end,
							'scalar:metadata:start_line_num': '',
							'scalar:metadata:end_line_num': '',
							'scalar:metadata:points': ''
						};
						break;
						
						case 'image':
						var dimensions = me.unparseDimensions(edits);
						relationData['annotation_of'] = {
							action: 'RELATE',
							'scalar:urn': annotation.body.current.urn,
							'scalar:child_urn': $('input[name="scalar:child_urn"]').val(),
							'scalar:child_rel': 'annotated',
							'scalar:metadata:start_seconds': '',
							'scalar:metadata:end_seconds': '',
							'scalar:metadata:start_line_num': '',
							'scalar:metadata:end_line_num': '',
							'scalar:metadata:points': dimensions.string
						};
						break;
						
					}
					dataArr.push({baseProperties:baseProperties, pageData:pageData, relationData:relationData});
				}
			}
		}
		
		me.showSpinner();
		
		scalarapi.modifyManyPages(dataArr, function(e) {
			$.annobuilder.view.builder.saveErrorOccured = e;
			$.annobuilder.view.builder.endSave();
		});

	}


	/**
	 * Completes the save action.
	 */
	jQuery.AnnoBuilderInterfaceView.prototype.endSave = function() {

		if (me.saveErrorOccurred) {
			alert('An error occurred while saving. Please try saving again.');
			this.leavingEditor = false;
		} else {
			$.annobuilder.controller.loadAnnotations();
			this.footerControls.find('#saveLink').css('display', 'none');
			this.footerControls.find('#doneMessage').css('display', 'inline');
			this.annotationList.find('.annotationChip').data('edits', null);
			this.dirtyAnnotations = [];
		}
		
		me.hideSpinner();

	}


}

jQuery.annobuilder = {
	model : new $.AnnoBuilderModel(),
	view : new $.AnnoBuilderView(),
	controller : new $.AnnoBuilderController()
}

