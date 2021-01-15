///////////////////////////////////////////////////
// List of available departments in JSON.        //
///////////////////////////////////////////////////
var departments = ["development","faculty-affairs","family-and-community-medicine","human-resources","internal-medicine","marketing-and-communications","health-professions","student-affairs","surgery"];
// var departments = ["internal-medicine",
//                    "student-affairs"];

// var departments = ["marketing-and-communications"];    

var dashboard = (function () {
  console.log('new js file')
  // click handler for load more stories button
  jQuery('#load-more-stories').click(function() {
    loadGrid(10);
  });
  
	var intGridItemsToLoad = 150,
			intLoadClickCount = 0,
			intMaxClickCount = 3;
  jQuery('#load-more-stories').click(function() {
		intLoadClickCount++;
		if (intLoadClickCount <= intMaxClickCount) {
			jQuery('.news-grid-container').attr('data-load', intLoadClickCount);
		}
  });

  var templates = {
    'details': undefined,
    'filter-item': undefined,
    'grid-item': undefined,
  };

  // global object for the filter labels
  var typeLabels = {
    'education': 'Education',
    'research': 'Research',
    'patient-care': 'Patient Care',
    'news': 'News',
    'event': 'Event',
    'social': 'Social',
  };

  // global array for the order of the filters
  var filterOrder = [
    'education',
    'patient-care',
    'research',
    'news',
    'event',
    'social',
  ];

  // create global state
  var state = {
  };

  var templateDir = 'templates/';

  var datafeeds = [];

  var stampItems = false;

  var gridItems = undefined;

  var $grid = undefined;

  /* 
    initializing function called in the index.html.
    accepts the options object as a parameter
  */
  function init(options) {
    // update the global state with options.state object
    state = Object.assign(state, options.state);

    // if template file path exists in the object then set the global templateDir variable to the options.templateDir object
    if(options.templateDir) {
      templateDir = options.templateDir;
    }
    // update global stamp items 
    stampItems = options.stampItems;
    // update global datafeeds 
    datafeeds = options.datafeeds;
    
    // call the search function and then after it has finished do more work
    search().then(function() {
      // call the build filter list function and pass in the filters object
      buildFilterList(options.filters);

      // configure and create the grid using isotope ??
      $grid = $container.isotope({
        layoutMode: 'packery',
        itemSelector: '.grid-item',
        initLayout: false,
        filter: '.pin'
      });
      
      // ? check to see if images are loaded
      $grid.imagesLoaded().progress( function() {
        $grid.isotope();
      });

      // call the toggle filter function
      toggleFilter();
      
      // show the container or grid when it is populated
      $container.show();
    });
    
  }

  function addDays(date, days) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function httpRequest(promise) {
    var dfd = jQuery.Deferred();

    promise
      .then(function(data) { dfd.resolve(data); })
      .fail(function() { dfd.resolve([]); });

    return dfd.promise();
  }

  var $container = jQuery('.grid');



  // called in init()
  function search() {

    return jQuery.when(
      // call the merge data feed function and pass in the datafeeds as a param
      mergeDataFeed(datafeeds),
      httpRequest(fetchInstagram()),
      httpRequest(fetchFacebook()),
      httpRequest(fetchTwitter()),
    )
      .then(save)
      .then(loadTemplates)
      // .then(loadPulse)
      .then(function() {
        return loadGrid(intGridItemsToLoad);
      })
  }

  function getStamps(items) {
    if(!stampItems) return [];

    return items
      .filter(function(value){
        return value.stamp;
      })
      .map(function(v) {
        return v.id;
      });
  }

  function loadTemplates() {
    var dfd = jQuery.Deferred();
    var workDone = 0;

    var templateKeys = Object.keys(templates);

    templateKeys.forEach(function(template) {
      jQuery.get(templateDir + template + '.html', function(templateHtml) {
        templates[template] = templateHtml;
        workDone++;
        if (workDone == templateKeys.length) {
          dfd.resolve();
        }
      });  
    });

    return dfd.promise();
  }

  function pinningSort(item){
    var delimiter = "@@@";
    if(item.title.indexOf(delimiter) !== -1){
      var parsedArray = item.title.split("@@@");
      item.title = parsedArray[1];
      item.sort = -(4 - parseInt(parsedArray[0]));
    }
    return item;
  }

  function save(storiesResults, instagramResults, facebookResults, twitterResults){
    var allResults = storiesResults.concat(instagramResults).concat(facebookResults).concat(twitterResults);
    var stamps = getStamps(allResults);

    var results = allResults;

    var groupBy = results.reduce(function (r, a) {
      var type = a.type.lookup;
      r[type] = r[type] || [];
      r[type].push(a);
      return r;
    }, Object.create(null));
    
    if (groupBy['event']) {
      groupBy['event'] = groupBy['event']
      .sort(function(a, b) {
        var aDateTime = Date.parse(a.startDate);
        var bDateTime = Date.parse(b.startDate);
        return aDateTime - bDateTime;
      });
    }

    var cmp = function(a, b) {
      if (a > b) return +1;
      if (a < b) return -1;
      return 0;
    };

    departmentResults = [];

    results = results
      .map(function(item) {
        var weight = results.length/groupBy[item.type.lookup].length;
        var index = groupBy[item.type.lookup].findIndex(
          function(typeItem){ 
            return typeItem.id === item.id; 
          })
        item.sort = (index) * weight;

        item = pinningSort(item);

        let tags = item.tags
        
        // [Tag Filter]
        // filter for tags
        let tagFilter = 'library'
        
        tags.forEach(function(tag) {
          // add to if statement to check for library with capital l: tagFilter.charAt(0).toUpperCase() + tagFilter.slice(1)
          // add additional filters if needed using or (||) statements
          if(tag === tagFilter || tag === 'pulse') {
            departmentResults.push(item)
          }
        });

        return item;

      })
      .sort(function(a, b) {
        return cmp(stamps.indexOf(b.id) > -1,stamps.indexOf(a.id) > -1) || cmp(a.sort,b.sort);
      });

    if(departmentResults.length > 0){
      results = departmentResults;
    }

    results = results
      .map(function(item) {
        if (!item.title) {
          item.title = '';
        }
        if(item.ratio === '2-2' && item.title) {
          var maxLength = item.image ? 85 : 295;
          if(item.title.length > maxLength) {
            var lastWordIndex = item.title.substring(0, maxLength).lastIndexOf(' ');
            item.title = item.title.substring(0, lastWordIndex).trim();
            item.title += "...";
          }
        }

        item.stamp = stamps.indexOf(item.id) > -1;

        item.isTitleLonger = function(max) {
          return item.title.length > max;
        }
        return item;
    })

    gridItems = results;
    // return $.when(null); 
  }

  function mergeDataFeed(feeds) {
    var mergedData = [];
    var workDone = 0;
    var dfd = jQuery.Deferred();

    for (var i = 0; i < feeds.length; i++) {
      var feed = feeds[i];
      jQuery.when(fetchJsonFile(feed.url, feed.tags))
       .then(function(value) {
          mergedData = mergedData.concat(value);
          workDone++;

          if(workDone == feeds.length) {
            mergeData = mergedData.sort(function(a, b) {
              var aDateTime = Date.parse(a.startDate);
              var bDateTime = Date.parse(b.startDate);
              return bDateTime - aDateTime;
            });
            dfd.resolve(mergedData);
          }
       });
    }

    return dfd.promise();
  }

  //START - JSM - 1/23/2020 - 12:48PM - Disabled all forms of scrolling, X and Y inside the modal.
  function disableAllScrolling(e){
      if(e.originalEvent.deltaY > 0) {
          e.preventDefault();
          return;
      } else if (e.originalEvent.wheelDeltaY < 0) {
          e.preventDefault();
          return;
      }
      if(e.originalEvent.deltaY < 0) {
          e.preventDefault();
          return;
      } else if (e.originalEvent.wheelDeltaY > 0) {
          e.preventDefault();
          return;
      } 
      if(e.originalEvent.deltaX > 0) {
          e.preventDefault();
          return;
      } else if (e.originalEvent.wheelDeltaX < 0) {
          e.preventDefault();
          return;
      }
      if(e.originalEvent.deltaX < 0) {
          e.preventDefault();
          return;
      } else if (e.originalEvent.wheelDeltaX > 0) {
          e.preventDefault();
          return;
      } 
  }
  //END - JSM - 1/23/2020 - 12:48PM - Disabled all forms of scrolling, X and Y inside the modal.

  function loadGrid(count) {
    for (var i = 0; i < count; i++) {
      var data = gridItems.shift();
      if(!data) {
        continue;
      }

      render(data, "grid-item", function (html, source) {
        var item = jQuery(html);
        
        item.click(function () {
          if(source.type.lookup === 'social') {
            window.open(source.link);
          } else {
            render(source, "details", function (html) {
              $("#improvedModal").html(html);
              $("#improvedModal").css("display", "block");
              $("#improvedModal").on("wheel mousewheel", function(e){
                  disableAllScrolling(e);
              });
              //jQuery('#myModalNews').modal({ show: true });
            });
          }
        });
//        item[0].style.display = 'none';
        $container.append(item);
      });      
    }

    if (!gridItems || !gridItems.length) {
      jQuery('#loadMoreStories').hide();
    }

    return jQuery.when();
  }

  var bootstrapCols = {
    '2': [12, 6, 4],
		'4': [12, 6, 8],
		'6': [12, 6, 12]
  }

  function fetchInstagram() {
    var ratio = '2-2';
    var grid = bootstrapCols[ratio.split('-')[0]];

    var request = jQuery.get('https://api.instagram.com/v1/users/self/media/recent?access_token=417324118.1677ed0.e01d744016f64024a112ec8732652d09&count=5');
    return jQuery.when(request)
      .then(function (data) {
        var list = data.data.map(function (item) {
            var data = {
              id: item.id,
              type: {
                lookup: 'social',
                icon: 'instagram',
                display: 'Social'
              },
              title: item.caption ? item.caption.text : '',
              link: item.link,
              startDate: formatDate(new Date(Date.parse(item.created_time))),
              grid: {
                xs: grid[0],
                md: grid[1],
                lg: grid[2],
              },
              ratio: ratio,
              image: {
                src: item.images.standard_resolution.url
              },
            };
            return data;
        })
        .filter(function (value) {
          return Date.parse(value.startDate) > addDays(Date.now(), -14);
        })
        .sort(function(a, b) {
          var aDateTime = Date.parse(a.startDate);
          var bDateTime = Date.parse(b.startDate);
          return bDateTime - aDateTime;
        })
        .splice(0, 5);

        return list;
      });
  }  

  function fetchTwitter() {
    var dfd = jQuery.Deferred();

    var ratio = '2-2';
    var grid = bootstrapCols[ratio.split('-')[0]];

    var configProfile = {
      profile: {"screenName": 'EVMSedu'},
      customCallback: function pushTweetsToSocialObject(tweets) {
        var list = tweets.map(function (item) {

          var data = {
            id: item.tid,
            type: {
              lookup: 'social',
              icon: 'twitter',
              display: 'Social'
            },
            title: item.tweet,
            link: item.permalinkURL,
            startDate: formatDate(new Date(Date.parse(item.timestamp))),
            grid: {
              xs: grid[0],
              md: grid[1],
              lg: grid[2],
            },
            ratio: ratio,
            image: item.image ? {
              src: item.image
            } : undefined,
          };
          return data;
        })
        .filter(function (value) {
          return Date.parse(value.startDate) > addDays(Date.now(), -14);
        })
        .sort(function(a, b) {
          var aDateTime = Date.parse(a.startDate);
          var bDateTime = Date.parse(b.startDate);
          return bDateTime - aDateTime;
        })
        .splice(0, 5);

        dfd.resolve(list);
      },
      showTime: true,
      parseLinks: false,
      permalinks: false,
      enableLinks: false,
      dataOnly: true,
      showRetweet: false
    };


    //twitterFetcher.fetch(configProfile);

    setTimeout(function() {
      if(dfd.state() === "pending") {
        // console.log('twitter feed timed out')
        dfd.reject();
      }
    }, 5000);

    return dfd.promise();
  }

  function fetchFacebook() {
    var ratio = '2-2';
    var grid = bootstrapCols[ratio.split('-')[0]];

    var request = jQuery.get('https://graph.facebook.com/322547340729?access_token=1750226411947971%7C0kh9j7sUHPSBY7MuKnKRI5j-fmE&fields=posts.limit(5)%7Bfull_picture%2Clink%2Cmessage%2Ccreated_time%7D&method=get&pretty=0&sdk=joey&suppress_http_code=1');
    var results = jQuery.when(request).fail(function(){ 
      return [];
    });


    return jQuery.when(results)
      .then(function (data) {
        if(data.error) {
          return [];
        }

        var list = data.posts.data.map(function (item) {
            var data = {
              id: item.id,
              type: {
                lookup: 'social',
                icon: 'facebook',
                display: 'Social'
              },
              title: item.message,
              link: item.link,
              startDate: formatDate(new Date(Date.parse(item.created_time))),
              grid: {
                xs: grid[0],
                md: grid[1],
                lg: grid[2],
              },
              ratio: ratio,
              image: {
                src: item.full_picture
              },
            };
            return data;
        })
        .filter(function (value) {
          return Date.parse(value.startDate) > addDays(Date.now(), -14);
        })
        .sort(function(a, b) {
          var aDateTime = Date.parse(a.startDate);
          var bDateTime = Date.parse(b.startDate);
          return bDateTime - aDateTime;
        })
        .splice(0, 5);

        return list;
      });
  }

  function fetchJsonFile(url, tags) {
    return jQuery.when(jQuery.get(url))
      .then(
        function (notifications) {
          var now = new Date();

          notifications = notifications
            .filter(function (value) {
              return value.data;
            })
            .filter(function(value) {
              var type = getType(value.type, value.primary);
              var startDate = new Date(Date.parse(value.data.date));

              startDate.setDate(startDate.getDate() + 1);
              return type.lookup === 'event' && startDate > new Date() || type.lookup != 'event';
            })
            .filter(function (value) {
              if(tags && tags.length) {
                return value.tags && value.tags.some(function(v) { return tags.indexOf(v) > -1; })
              } else {
                return true;
              }
            });


          var list = notifications.map(notification => {
            var ratio = notification.data.ratio;

            var grid = bootstrapCols[ratio.split('-')[0]];

            var type = getType(notification.type, notification.primary);
            var data = {
              id: notification.data['content-id'],
              type: {
                lookup: type.lookup,
                icon: type.lookup,
                display: type.display
              },
              tags: notification.tags,
              title: notification.data.title,
              description: notification.data.description,
              byline: notification.data.byline,
              link: notification.data.link,
              tagsUrls: notification['tag-urls'],
              startDate: formatDate(new Date(Date.parse(notification.data.date))),
              startTime: notification.data['start-time'],
              grid: {
                xs: grid[0],
                md: grid[1],
                lg: grid[2],
              },
              ratio: ratio,
              image: isEmpty(notification.data.image) ? undefined : notification.data.image,
              stamp: new Date(notification.data.stamp) > now
            };

            return data;

          });

          return list;

        }
      );
  }

  function isEmpty(obj) { 
    return !obj || (Object.keys(obj).length === 0 && obj.constructor === Object)
  }

  function isPulse(tags) {
    return tags && tags.some(function (tag) {
      return tag === 'pulse';
    });
  }

  function render(data, template, callback) {
    var templateHtml = templates[template];
    var template = jQuery.templates(templateHtml);
    var html = template.render(data);
    if (callback)
      callback(html, data);
  }

  function toggleFilter(filter) {
    if(filter) {
      console.log('this is the filter ' + filter)
      state.filters[filter] = !state.filters[filter];
    }

    // ? add pinning class to element 
    var classFilter = '.pin';

    // create an array of filter keys
    var filterKeys = Object.keys(state.filters);

    // returns a list of active filters and updates the applications state
    var activeFilters = filterKeys
      .filter(function(v) {
        return state.filters[v];
      });

      // console.log('these are the active filters' + activeFilters)

      // ? if activeFilters is 0 then reset the applications state
    if(activeFilters.length === 0) {
      // console.log('this is what happens with no filters ' + state.filters[filter])
      state.filters[filter] = true;
      return false;
    }

    /**
     * ? compare the size of the active filters array and filter keys array. 
     * if the arrays are not equal length but active filters is greater than 0 then add a pin filter to the active filters
     */
    if(activeFilters.length === filterKeys.length) {
      classFilter = '*';
    } else if(activeFilters.length > 0) {
      classFilter = '.pin, ' + activeFilters
        .map(function(v) {
          return '.' + v;
        })
        .reduce(function(pv, cv) {
          if(pv) {
            pv += ', ';
          }
          return pv + cv;
        });
    }
    
    // do something with the grid isotope library
    $grid.isotope({ 
      filter: classFilter 
    });

    return true;
  }

  function formatDate(date) {
		// start delete once t4 date issue is fixed
    var testDate = new Date(date);
    testDate.setDate(date.getDate() + 1);
    var newDate = testDate.getDate();
    var formattedDate = ('0' + newDate).slice(-2);
  // end delete

    //var formattedDate = ('0' + date.getDate()).slice(-2); // uncomment once t4 date issue is fixed
    var formattedMonth = ('0' + (testDate.getMonth() + 1)).slice(-2);
    var formattedYear = testDate.getFullYear().toString().substr(2, 2);

    var dateString = formattedMonth + '/' + formattedDate + '/' + formattedYear;

    return dateString;
  }


  function getType(types, primary) {
    var keys = Object.keys(typeLabels);

    if (primary) {
      if (typeof (primary) == 'string') {
        primary = [primary];
      }
      types = primary;
    }

    var key = types.find(function (type) {
      return keys.some(function (key) {
        return type === key;
      });
    });

    return {
      lookup: key,
      display: typeLabels[key]
    };
  }

  function buildFilterList(items) {
    if (!items) {
      items = {};
    }


    if (!Object.keys(items).length) {
      jQuery('.filters').hide();
      return;
    }

    filterOrder.forEach(function (key) {
      if(!items[key]){
        return;
      }

      var filter = {
        value: key,
        display: items[key]
      };

      filter.checked = state.filters[filter.value];
      render(filter, "filter-item", function (html) {
        var item = jQuery(html);
        jQuery('input', item).change(function (event) {
          if(!toggleFilter(filter.value)){
            jQuery(event.target).prop('checked',true);
          }
        });

        jQuery('.filters').append(item);
      });
    });
  }


  return {
    search: search,
    toggleFilter: toggleFilter,
    init: init,
  };
})();