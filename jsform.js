/**
 * Form fields iterator
 * for fields with [name=module/group/field]
 *
 * @author Alejandro Moraga <moraga86@gmail.com>
 */

'use strict';

var re = {
	crop: /\d+x\d+/,
	list: /([^\d]+)\d{6,}/,
	id: /\d{5,}/,
	required: /\s+required\b/g,
	statefield: /^checkbox|^radio/
};

// shortcuts
var slice = Array.prototype.slice;
var push = Array.prototype.push;
var concat = Array.prototype.concat;
var reduce = Array.prototype.reduce;

//
// Core
//

// main class
// all objects are instances of this class
function f(parent, depth) {
	// static properties
	Object.defineProperties(this, {
		parent: {value: parent || null},
		depth : {value: depth  || 0}
	});
	
	// dynamic properties
	Object.defineProperties(this, f.auto);
}

// dynamic properties definition
f.auto = {
	// first form field (f object)
	first: {
		get: function() {
			return this.get(0);
		}
	},
	// last form field (f object)
	last: {
		get: function() {
			return this.get(-1);
		}
	},
	// all form fields (f object)
	form: {
		get: function() {
			var hasown = false, refs = {};
			for (var prop in this)
				if (this[prop] instanceof f) {
					refs[prop] = this[prop];
					hasown = true;
				}
			return hasown ? refs : null;
		}
	},
	// all html form fields
	fields: {
		get: function() {
			var fields = [];
			// module, group or filter result
			if (this.length == 0)
				for (var prop in this.form)
					// catch form fields from up levels
					fields = concat.call(fields, slice.call(this[prop].fields, 0));
			else
				fields = concat.call(fields, slice.call(this, 0));
			return fields;
		}
	},
	// all form fields id (own rule)
	id: {
		get: function() {
			return this.fetch(function(arr, input) {
				var id = input.name.match(re.id);
				if (id) {
					id = parseInt(id[0]);
					// only uniques
					if (arr.indexOf(id) == -1)
						arr.push(id);
				}
				return arr;
			});
		}
	},
	// all form field values (as string or array)
	value: {
		get: function() {
			return this.fetch(function(arr, input) {
				// form field type validation
				if (!input.type.match(re.statefield) || input.checked || input.selected)
					arr.push(input.value);
				return arr;
			});
		},
		set: function(value) {
			this.each(function() {
				switch (this.type) {
					case 'radio':
					case 'checkbox':
						this.checked = this.value == value || value === true;
						break;
					default:
						this.value = value;
						break;
				}
			});
		}
	},
	// HTMLElement (own interactions)
	baseElement: {
		get: function() {
			// implement your direction rules
			// module
			if (this.depth == 1) {
				var base = this.firstElement;
				while (base.className.indexOf('module') == -1)
					base = base.parentNode;
				return base.firstElementChild.firstElementChild;
			}
			// group
			else if (this.depth == 2) {
				var base = this.firstElement;
				while (base.className.indexOf('group') == -1)
					base = base.parentNode;
				base = base.firstElementChild.firstElementChild;
				return base;
			}
			// fieldset
			else if (this.length) {
				for (var i = 0; i < this.length; i++)
					if (this[i].type != 'radio' || this[i].checked)
						break;
				var input = this[i];
				switch (input.type) {
					case 'radio':
						return input.parentNode;
					case 'checkbox':
						return input.parentNode.previousElementSibling;
					default:
						return input.previousElementSibling;
				}
			}
		}
	},
	// first element from fieldset or return the baseElement (module or group)
	firstElement: {
		get: function() {
			if (this.length == 0) {
				var found = null;
				for (var prop in this.form)
					if (found = this[prop].firstElement)
						break;
				return found;
			}
			else {
				return this.baseElement;
			}
		}
	},
	// title or label for module, group or field
	title: {
		get: function() {
			return this.baseElement.textContent;
		},
		set: function(value) {
			this.baseElement.innerHTML = value;
		}
	},
	// title alias
	label: {
		get: function() { return this.title },
		set: function(value) { this.title = value }
	}
};

// static properties definition
f.fn = f.prototype = {
	length: 0,
	
	get: function(i) {
		return i == -1 ? this.slice(i) : this.slice(i, i + 1);
	},
	
	push: function() {
		push.apply(this, arguments);
	},
	
	slice: function() {
		var a = new f;
		var items = slice.apply(this, arguments);
		a.length = items.length;
		for (var i = 0; i < items.length; a[i] = items[i++]);
		return a;
	},
	
	reduce: function() {
		return reduce.call(this.fields, arguments[0], arguments[1] || []);
	},
	
	fetch: function() {
		var values = this.reduce.apply(this, arguments);
		if (values.length == 0)
			return false;
		return values.length == 1 ? values[0] : values;
	},
	
	each: function(fn) {
		for (var fields = this.fields, i = 0; i < fields.length; fn.call(fields[i], i++));
	},
	
	// finds one form field from any path/depth
	find: function(selector, query) {
		var dest = selector.split('.');
		var base = this;
		for (var i = 0; i < dest.length; i++) {
			if (dest[i] in base) {
				base = base[dest[i]];
			}
			else {
				var find = null;
				for (var prop in base) {
					if (base[prop] instanceof f && dest[i] in base[prop]) {
						find = base[prop][dest[i]];
						break;
					}
				}
				if (!find) {
					for (var prop in base) {
						if (base[prop] instanceof f) {
							if (find = base[prop].find(dest[i]))
								break;
						}
					}
				}
				if (find)
					base = find;
				else
					return null;
			}
		}
		
		return query ? base.filter(query) : base;
	},

	// finds all form fields from any path/depth
	findAll: function(selector, query) {
		var dest = selector.split('.');
		var ret = new f;
		var base = this;
		for (var i = 0; i < dest.length; i++) {
			if (dest[i] in base) {
				base = base[dest[i]];
			}
			else {
				var find = null;
				for (var prop in base) {
					if (base[prop] instanceof f && dest[i] in base[prop]) {
						find = base[prop][dest[i]];
						for (var k = 0; k < find.length; k++)
								ret[ret.length++] = find[k];
					}
				}
				if (!find) {
					for (var prop in base) {
						if (base[prop] instanceof f) {
							if (find = base[prop].find(dest[i]))
								for (var k = 0; k < find.length; k++)
									ret[ret.length++] = find[k];
						}
					}
				}

			}
		}
		
		if (ret.length == 0)
			return null;

		return query ? ret.filter(query) : ret;
	},
	
	// filter form fields and returns a new f structure
	filter: function(query) {
		if (this.form) {
			var find = new f(this, this.depth);
			for (var item in this.form) {
				var found = this[item].filter(query);
				find[item] = found;
			}
			return find;
		}
		else {
			var input = this.reduce(function(arr, input) {
				if (query.id && input.name.indexOf(query.id) != -1)
					arr.push(input);
				return arr;
			});
			
			if (input.length > 0) {
				var find = new f(this, this.depth);
				find.push.apply(find, input);
				return find;
			}
		}
		return null;
	},
	
	parse: function() {
		var list = document.querySelectorAll('input, select, textarea');
		for (var i = 0; i < list.length; i++) {
			if (list[i].name) {
				var elem = list[i];
				var area = elem.name.split('/');
				if (area.length > 1) {
					var base = this;
					for (var j = 0; j < area.length; j++) {
						area[j] = area[j].replace(re.list, '$1');
						if (!(area[j] in base) || !(base[area[j]] instanceof f))
							base[area[j]] = new f(base, j+1);
						base = base[area[j]];
					}
					base[base.length++] = elem;
				}
			}
		}
	}
};

//
// Extensions
//

f.fn.load = function(list) {
	var node, i;
	
	// group, generic loader
	list.unshift([]);
	
	// prepare list
	for (i = list.length; i-- > 1;) {
		// move to generic loader
		if (list[i].indexOf('/') == -1)
			list[0].push(list.splice(i, 1)[0]);
		// external reference
		else {
			// check file extension
			if (!list[i].match(/\.[a-z]{2,3}$/) || list[i].substr(-3) == 'min')
				list[i] += '.js';
			// set up base path
			// if (list[i].indexOf('//') == -1)
				// list[i] = 'origin..' + list[i];
		}
	}
	
	if (list[0].length)
		list.push('//loader..' + list.shift().join(','));
	else
		list.shift();
	
	// load the scripts
	for (i = 0; i < list.length; i++) {
		node = document.createElement('script');
		node.type = 'text/javascript';
		node.src = list[i];
		document.body.appendChild(node);
	}
};

// gets the struture groupped by id
f.fn.groups = function() {
	var rel = [];
	
	if (this.form) {
		for (var prop in this.form) {
			var find = this[prop].groups();
			if (find) {
				for (var i = 0; i < find.length; i++) {
					for (var j = 0; j < rel.length; j++)
						if (rel[j].$id == find[i].$id)
							break;
					if (j == rel.length) {
						rel.push(new f(this, this.depth));
						rel[j].$id = find[i].$id;
					}
					rel[j][prop] = find[i];
				}
			}
		}
	}
	else {
		for (var i = 0; i < this.length; i++) {
			var id = this[i].name.match(re.id);
			if (id) {
				var find = null;
				for (var j = 0; j < rel.length; j++)
					if (rel[j].$id == id[0])
						break;
				if (j == rel.length) {
					rel.push(new f(this, this.depth));
					rel[j].$id = id[0];
				}
				rel[j].push(this[i]);
			}
		}
	}
	
	return rel;
};

// appends one or more elements
f.fn.append = function() {
	var self = $(this.baseElement);
	self.append.apply(self, arguments);
};

// adds an event
f.fn.on = function(name, callback) {
	var scope = this;
	this.each(function() {
		$(this).bind(name, function() {
			callback.apply(scope, arguments);
		});
	});
};

// adds multiple events
// {'event selector': callback, ...}
f.fn.events = function(set) {
	var key, obj, pos;
	for (key in set) {
		pos = key.lastIndexOf(' ');
		if (obj = this.find(key.substr(pos + 1))) {
			obj.on(key.substr(0, pos), set[key]);
		}
	}
};

// show module, group or field
f.fn.show = function() {
	// modules and groups
	if (this.depth <= 2) {
		this.baseElement.parentNode.parentNode.style.display = 'block';
	}
	// fields
	else {
		this.each(function() {
			$(this).closest('fieldset').show();
		});	
	}
};

// hide module, group or field
f.fn.hide = function() {
	// module and groups
	if (this.depth <= 2) {
		this.baseElement.parentNode.parentNode.style.display = 'none';
	}
	// fields
	else {
		this.each(function() {
			$(this).closest('fieldset').hide();
		});
	}
};

// enable form fields
f.fn.enable = function() {
	this.each(function() {
		$(this).closest('fieldset').show().end().removeAttr('disabled');
	});
};

// disable form fields
f.fn.disable = function() {
	this.each(function() {
		$(this).closest('fieldset').hide().end().attr('disabled', 'disabled');
	});
};

// set up form field as read only
f.fn.readonly = function(status) {
	this.each(function() {
		// not readonly
		if (status === false) {
			this.removeAttribute('readonly');
			this.style.backgroundColor = '';
		}
		// readonly
		else {
			this.setAttribute('readonly', 'readonly');
			this.style.backgroundColor = '#eaeaea';
			this.addEventListener('click', function() {
				this.select();
			}, false);
		}
	});
};

// set up form fields are required
f.fn.required = function(status) {
	this.each(function() {
		// not required
		if (status === false) {
			this.className = this.className.replace(re.required, '');
		}
		// required
		else {
			this.className += ' required';
		}
	});
};

// change image sizes
f.fn.crop = function(crop) {
	var size = re.crop.exec(crop);
	this.each(function() {
		this.value = this.value.replace(re.crop, size);
		$(this.parentNode)
			.find('label').hide().filter(':contains('+ size +')').show()
			.find('input').get(0).checked = true;
	});
};

//
// Init
//

window.attachEventListener('load', function() {
	// global instance
	(window.Form = new f).parse();
	
	// Form.load([ scripts ]);
});
