// https://github.com/mifi/ical-expander

// refresh timeout every 5 minutes
var CURR_WEATHER_TIMEOUT = 300000;

// store the last time the full page was reloaded
var lastReloadDay = new Date().getDay();
console.log(lastReloadDay);

class IcalExpander {
  constructor(opts) {
    this.maxIterations = opts.maxIterations != null ? opts.maxIterations : 1000;
    this.skipInvalidDates = opts.skipInvalidDates != null ? opts.skipInvalidDates : false;

    this.jCalData = ICAL.parse(opts.ics);
    this.component = new ICAL.Component(this.jCalData);
    this.events = this.component.getAllSubcomponents('vevent').map(vevent => new ICAL.Event(vevent));

    if (this.skipInvalidDates) {
      this.events = this.events.filter((evt) => {
        try {
          evt.startDate.toJSDate();
          evt.endDate.toJSDate();
          return true;
        } catch (err) {
          // skipping events with invalid time
          return false;
        }
      });
    }
  }

  between(after, before) {
    function isEventWithinRange(startTime, endTime) {
      return (!after || endTime >= after.getTime()) &&
        (!before || startTime <= before.getTime());
    }

    function getTimes(eventOrOccurrence) {
      const startTime = eventOrOccurrence.startDate.toJSDate().getTime();
      let endTime = eventOrOccurrence.endDate.toJSDate().getTime();

      // If it is an all day event, the end date is set to 00:00 of the next day
      // So we need to make it be 23:59:59 to compare correctly with the given range
      if (eventOrOccurrence.endDate.isDate && (endTime > startTime)) {
        endTime -= 1;
      }

      return { startTime, endTime };
    }

    const exceptions = [];

    this.events.forEach((event) => {
      if (event.isRecurrenceException()) exceptions.push(event);
    });

    const ret = {
      events: [],
      occurrences: [],
    };

    this.events.filter(e => !e.isRecurrenceException()).forEach((event) => {
      const exdates = [];

      event.component.getAllProperties('exdate').forEach((exdateProp) => {
        const exdate = exdateProp.getFirstValue();
        exdates.push(exdate.toJSDate().getTime());
      });

      // Recurring event is handled differently
      if (event.isRecurring()) {
        const iterator = event.iterator();

        let next;
        let i = 0;

        do {
          i += 1;
          next = iterator.next();
          if (next) {
            const occurrence = event.getOccurrenceDetails(next);

            const { startTime, endTime } = getTimes(occurrence);

            const isOccurrenceExcluded = exdates.indexOf(startTime) !== -1;

            // TODO check that within same day?
            const exception = exceptions.find(ex => ex.uid === event.uid && ex.recurrenceId.toJSDate().getTime() === occurrence.startDate.toJSDate().getTime());

            // We have passed the max date, stop
            if (before && startTime > before.getTime()) break;

            // Check that we are within our range
            if (isEventWithinRange(startTime, endTime)) {
              if (exception) {
                ret.events.push(exception);
              } else if (!isOccurrenceExcluded) {
                ret.occurrences.push(occurrence);
              }
            }
          }
        }
        while (next && (!this.maxIterations || i < this.maxIterations));

        return;
      }

      // Non-recurring event:
      const { startTime, endTime } = getTimes(event);

      if (isEventWithinRange(startTime, endTime)) ret.events.push(event);
    });

    return ret;
  }

  before(before) {
    return this.between(undefined, before);
  }

  after(after) {
    return this.between(after);
  }

  all() {
    return this.between();
  }
}

function registerTimezones() {
  Object.keys(timezones).forEach((key) => {
    const icsData = timezones[key];
    const parsed = ICAL.parse(`BEGIN:VCALENDAR\nPRODID:-//tzurl.org//NONSGML Olson 2012h//EN\nVERSION:2.0\n${icsData}\nEND:VCALENDAR`);
    const comp = new ICAL.Component(parsed);
    const vtimezone = comp.getFirstSubcomponent('vtimezone');

    ICAL.TimezoneService.register(vtimezone);
  });
}

$(function () {
  return $("#myPhotos").on("slide.bs.carousel", function (ev) {
    var lazy;
    lazy = $(ev.relatedTarget).find("img[data-src]");
    lazy.attr("src", lazy.data('src'));
    lazy.removeAttr("data-src");
  });
});


function refreshTodaysAgenda() {
  var todayHtml = '';
  //console.log(agendaItems.length);
  // sort the items
  var x = agendaItems.sort(function (a, b) {
    // Turn your strings into dates, and then subtract them
    // to get a value that is either negative, positive, or zero.
    return a.date - b.date;
  });

  // now, let's loop through our array and build our html
  for (var i = 0; i < agendaItems.length; i++) {
    todayHtml += '<h5 class="card-title">' + agendaItems[i].summary + '</h5>';
  }

  // update the actual html (this will not work...)
  $('#dailyAgenda').html(todayHtml);
}


parseHolidayData = function (data) {
  //console.log("Trying to do the holidays...")
  holidayEvents = {
    events: []
  };

  // figure out today...
  var today = '';
  var d = new Date();
  var curr_year = d.getFullYear();
  var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
  var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';

  // 20210313: UPDATE
  // changing to be current month + 1, so we get the bleed-over into the following
  // this is helpful particularly during the last week or so of the month
  var beforeString = curr_year.toString() + '-' + (curr_month + 2).toString() + '-01';
  if ((curr_month+2 != 12) && ((curr_month + 2) % 12 < curr_month)) {
    beforeString = (curr_year + 1).toString() + '-' + ((curr_month + 2) % 12).toString() + '-01';
  }

  // get the events for the current month
  const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
  const results = icalExpander.between(new Date(afterString), new Date(beforeString));
  const mappedEvents = results.events.map(e => ({ startDate: e.startDate, endDate: e.endDate, duration: e.duration, summary: e.summary }));
  const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
  const allEvents = [].concat(mappedEvents, mappedOccurrences);

  var count = allEvents.length;
  //console.log("Found " + String(count) + " HVA Days(s)");
  if (count > 0) {
    // this is ephemeral... so we'll need to combine it if we get fancy

    var curr_date_string = d.toDateString();
    var agendaItems = [];

    // loop through each event found
    allEvents.forEach(function (item) {

      var item_jsdate = item.startDate.toJSDate();
      var item_endDate = item_jsdate; //item.endDate.toJSDate();
      if (item.endDate) {
        item_endDate = item.endDate.toJSDate();
      }
      var allDay = false;
      if (item.duration && item.duration.days >= 1) {
        allDay = true;
      }
      
      holidayEvents.events.push({
        title: item.summary,
        start: item_jsdate,
        end: item_endDate,
        allDay: allDay,
        display: 'background'
      });
    });

    myCalendar.addEventSource(holidayEvents);
    refreshTodaysAgenda();
  }
}


parseHVAData = function (data) {
  console.log("Trying to do the H/V Day Thing...")
  HVEvents = {
    events: []
  };

  // figure out today...
  var today = '';
  var d = new Date();
  var curr_year = d.getFullYear();
  var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
  var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';

  // 20210313: UPDATE
  // changing to be current month + 1, so we get the bleed-over into the following
  // this is helpful particularly during the last week or so of the month
  var beforeString = curr_year.toString() + '-' + (curr_month + 2).toString() + '-01';
  if ((curr_month+2 != 12) && ((curr_month + 2) % 12 < curr_month)) {
    beforeString = (curr_year + 1).toString() + '-' + ((curr_month + 2) % 12).toString() + '-01';
  }

  // get the events for the current month
  const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
  const results = icalExpander.between(new Date(afterString), new Date(beforeString));
  const mappedEvents = results.events.map(e => ({ startDate: e.startDate, endDate: e.endDate, duration: e.duration, summary: e.summary }));
  const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
  const allEvents = [].concat(mappedEvents, mappedOccurrences);

  var count = allEvents.length;
  console.log("Found " + String(count) + " H/V Days(s)");
  if (count > 0) {
    // this is ephemeral... so we'll need to combine it if we get fancy

    var curr_date_string = d.toDateString();
    var agendaItems = [];

    // loop through each event found
    allEvents.forEach(function (item) {

      var item_jsdate = item.startDate.toJSDate();
      var item_endDate = item_jsdate; //item.endDate.toJSDate();
      if (item.endDate) {
        item_endDate = item.endDate.toJSDate();
      }
      //var allDay = false;
      //if (item.duration && item.duration.days >= 1) {
      //  allDay = true;
     // }
        //title: item.summary,
      // HDay 013382
      // VDay 79b4e0
      if (item.summary.includes("H Day")){
        HVEvents.events.push({
          start: item_jsdate,
          end: item_endDate,
          allDay: true,
          display: 'background',
          backgroundColor: '#72afdb'
        });
      } else {
        HVEvents.events.push({
          start: item_jsdate,
          end: item_endDate,
          allDay: true,
          display: 'background',
          color: '#e6e6e6'
        });
      }
    });

    console.log("Prepared " + String(HVEvents.events.length) + "HV Events");
    myCalendar.addEventSource(HVEvents);
    //refreshTodaysAgenda();
  }
}


// global event list
var myCalEvents = [];
var agendaItems = [];
var todaysReading = 'not_set';

parseCalendarData = function (data) {
  // console.log('parseCalendarData()');

  // var today = '';
  var d = new Date();
  var curr_year = d.getFullYear();
  var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
  var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';

  // 20210313: UPDATE
  // changing to be current month + 1, so we get the bleed-over into the following
  // this is helpful particularly during the last week or so of the month
  var beforeString = curr_year.toString() + '-' + (curr_month + 2).toString() + '-01';
  console.log(beforeString);
  
  // 20221002: UPDATE
  // added logic to ensure curr_month+2 != 12. Otherwise, we ended up with an 
  // invalid month of 0, which would cause things to be quite unhappy.
  if ((curr_month+2 != 12) && ((curr_month + 2) % 12 < curr_month)) {
    beforeString = (curr_year + 1).toString() + '-' + ((curr_month + 2) % 12).toString() + '-01';
  }

  // console.log(afterString);
  // console.log(beforeString);
  

  // try the new approach
  const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
  const results = icalExpander.between(new Date(afterString), new Date(beforeString));
//  console.log(results.events.length);
  const mappedEvents = results.events.map(e => ({ startDate: e.startDate, endDate: e.endDate, duration: e.duration, summary: e.summary }));
  const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
  const allEvents = [].concat(mappedEvents, mappedOccurrences);

  var curr_date_string = d.toDateString();
//  console.log(curr_date_string);
//  console.log(allEvents.length);
  
  // loop through each event found
  allEvents.forEach(function (item) {

    var item_jsdate = item.startDate.toJSDate();
    var item_endDate = item_jsdate; //item.endDate.toJSDate();
    if (item.endDate) {
      item_endDate = item.endDate.toJSDate();
    }
    var allDay = false;
    if (item.duration && item.duration.days >= 1) {
      allDay = true;
    }

    // put the item on the calendar
    // if the item is *before* today...
    // console.log(item_jsdate);
    //#4db8ff - blue
    // #12264b HVA Dark Blue
    // #72afdb HVA Light Blue
    if (item_jsdate < d) {
      myCalEvents.push({
        title: item.summary,
        start: item_jsdate,
        end: item_endDate,
        allDay: allDay,
        color: '#e6e6e6',
        textColor: '#ccc',
        display: 'block'
      });
    } else {
      myCalEvents.push({
        title: item.summary,
        start: item_jsdate,
        end: item_endDate,
        allDay: allDay,
        color: '#72afdb',
        display: 'block'
      });
    }

    // if the item is today, let's add it to the agenda list
    if (item_jsdate.toDateString() === curr_date_string) {
      // place new item at the top of the list
      agendaItems.push({
        date: item_jsdate,
        summary: item_jsdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + item.summary
      });
    }
  });

  // render the calendar
  myCalendar.addEventSource(myCalEvents);
  refreshTodaysAgenda();
};






parseMealData = function (data) {
  // console.log("parseMealData()");
  var today = '';
  var d = new Date();
  var curr_year = d.getFullYear();
  var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
  var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';
  var beforeString = curr_year.toString() + '-' + (curr_month + 1).toString() + '-01';
  if (curr_month + 1 === 13) {
    beforeString = (curr_year + 1).toString() + '-01-01';
  }

  const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
  const results = icalExpander.between(new Date(afterString), new Date(beforeString));
  const mappedEvents = results.events.map(e => ({ startDate: e.startDate, endDate: e.endDate, duration: e.duration, summary: e.summary }));
  const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
  const allEvents = [].concat(mappedEvents, mappedOccurrences);

  var curr_date_string = d.toDateString();

  // loop through each event found
  allEvents.forEach(function (item) {
    var item_jsdate = item.startDate.toJSDate();

    // if the item is today, let's add it to the agenda list
    if (item_jsdate.toDateString() === curr_date_string) {
      agendaItems.push({date: null, summary: "Dinner: " + item.summary});
    }

  });
  refreshTodaysAgenda();
};


function startTime() {
  var today = new Date();
  var h = today.getHours();
  var m = today.getMinutes();
  var s = today.getSeconds();
  m = checkTime(m);
  s = checkTime(s);
  $("#myclock").html(h + ":" + m + ":" + s);
  var t = setTimeout(startTime, 500);
}

function checkTime(i) {
  if (i < 10) { i = "0" + i };  // add zero in front of numbers < 10
  return i;
}

getWindDir = function(dir) {
  var t=Math.round(dir/45);
  return["N","NE","E","SE","S","SW","W","NW","N"][t];
}

getWxIcon = function(code) {
  // Here's the available list from SKYCONS
  // Skycons.CLEAR_DAY
  // Skycons.CLEAR_NIGHT
  // Skycons.PARTLY_CLOUDY_DAY
  // Skycons.PARTLY_CLOUDY_NIGHT
  // Skycons.CLOUDY
  // Skycons.RAIN
  // Skycons.SHOWERS_DAY
  // Skycons.SHOWERS_NIGHT
  // Skycons.SLEET
  // Skycons.RAIN_SNOW
  // Skycons.RAIN_SNOW_SHOWERS_DAY
  // Skycons.RAIN_SNOW_SHOWERS_NIGHT
  // Skycons.SNOW
  // Skycons.SNOW_SHOWERS_DAY
  // Skycons.SNOW_SHOWERS_NIGHT
  // Skycons.WIND
  // Skycons.FOG
  // Skycons.THUNDER
  // Skycons.THUNDER_RAIN
  // Skycons.THUNDER_SHOWERS_DAY 
  // Skycons.THUNDER_SHOWERS_NIGHT
  // Skycons.HAIL
  // 
  // this is the list from openweathermap
  //   01d.png 	01n.png 	clear sky
  //   02d.png 	02n.png 	few clouds
  //   03d.png 	03n.png 	scattered clouds
  //   04d.png 	04n.png 	broken clouds
  //   09d.png 	09n.png 	shower rain
  //   10d.png 	10n.png 	rain
  //   11d.png 	11n.png 	thunderstorm
  //   13d.png 	13n.png 	snow
  //   50d.png 	50n.png 	mist
  var icon = Skycons.CLEAR_DAY;

  switch (code) {
    case '01d':
      icon = Skycons.CLEAR_DAY;
      break;
    case '01n':
      icon = Skycons.CLEAR_NIGHT;
      break;
    case '02d':
       icon = Skycons.PARTLY_CLOUDY_DAY;
       break;
    case '02n':
      icon = Skycons.PARTLY_CLOUDY_NIGHT;
      break;
    case '03d':
      icon = Skycons.PARTLY_CLOUDY_DAY;
      break;
    case '03n':
      icon = Skycons.PARTLY_CLOUDY_NIGHT;
      break;
    case '04d':
      icon = Skycons.CLOUDY;
      // console.log("Partly Cloudy");
      break;
    case '04n':
      icon = Skycons.CLOUDY;
      break;
    case '09d':
      icon = Skycons.SHOWERS_DAY;
      break;
    case '09n':
      icon = Skycons.SHOWERS_NIGHT;
      break;
    case '10d':
      icon = Skycons.RAIN;
      break;
    case '10n':
      icon = Skycons.RAIN;
      break;
    case '11d':
      icon = Skycons.THUNDER_SHOWERS_DAY;
      break;
    case '11n':
      icon = Skycons.THUNDER_SHOWERS_NIGHT;
      break;
    case '13d':
      icon = Skycons.SNOW_SHOWERS_DAY;
      break;
    case '13n':
      icon = Skycons.SNOW_SHOWERS_NIGHT;
      break;
    case '50d':
      icon = Skycons.FOG;
      break;
    case '50n':
      icon = Skycons.FOG;
      break;
    default:
      icon = Skycons.CLEAR_DAY;
      break;
  }
  return icon;
}

getWxDay = function(ndx) {
  var today=(new Date).getDay()
  var days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return ndx==0?"Today":days[(today+ndx)%7];
}

updateLocalWeather = function (data) {
  console.log("Updating Local Weather...");
  //console.log(data);
  var local_temp = data.results[0].series[0].values[0][1];
  var temp_ts = new Date(data.results[0].series[0].values[0][0]);
  $("#fe_temp").text((Math.round(local_temp)).toString() + "\xB0");


  // check the "staleness" of the temp. If it is too old (> 2 hours), 
  var stale = false;
  var temp_Time = temp_ts.getTime();
  var compare = new Date(temp_Time + 2 * 60 * 60 * 1000);
  var current = new Date();
  if (compare < current) {
    console.log('timestamp on local temp is too old. Marking stale')
    stale = true;
  }
  // hide the current and show the airport value
  if (stale) {
    $("#fe_temp").hide();
    $("#fe_temp2").show();
  } else {
    $("#fe_temp").show();
    $("#fe_temp2").hide();
  }
}

updateImages = function (data) {
  console.log("Updating images...");
  $('.carousel-inner').empty();
  var first=true;
  
  data.images.forEach((image) => {
    if (first) {
      $('.carousel-inner').append('<div class="carousel-item active"> <img class="d-block w-100" src="' + image + '" alt=""> </div>');      
      first = false;
    } else {
      $('.carousel-inner').append('<div class="carousel-item"> <img class="d-block w-100" src="' + image + '" alt=""> </div>');
    }
  });

}

// global for skycons
var skycons = null;

updateCurrentWeather = function (data) {
  console.log("Updating Current Weather...");

  // prepare for the animated icons
  if (!skycons) {
    skycons = new Skycons({"color":"#333"});
  } else {
    skycons.pause();
  }

  // handle the current temperature and conditions
  $("#fe_temp2").text((Math.round(data.current.temp)).toString() + "\xB0");
  $("#fe_summary").text(data.current.weather[0].main);
  var wind = Math.round(data.current.wind_speed);
  $("#fe_wind").text("Wind: " + wind.toString() + " mph (" + getWindDir(data.current.wind_deg) + ")");
  skycons.remove("fe_current_icon");
  skycons.add("fe_current_icon", getWxIcon(data.current.weather[0].icon));

  // do some prep work to figure out how long each day's temperature
  // spread bar should be
  var numDays = data.daily.length;
  var maxFound = -Infinity;
  var minFound = Infinity;
  for(var d=0; d < numDays; d++) {
    var l = data.daily[d];
    if (l.temp.max > maxFound) {
      maxFound = l.temp.max;
    }
    if (l.temp.min < minFound) {
      minFound = l.temp.min;
    }
  }

  console.log("Min: " + minFound.toString());
  console.log("Max: " + maxFound.toString());

  var maxRange = 82; // this is dictated by the desired height
  var actualRange = maxFound - minFound;
  var height;
  var top;
  console.log(actualRange);

  // build out the forecast
  var i = 0;
  for (i = 0; i < 8; i++) {
    var d = data.daily[i];
    $("#fe_high_temp" + i.toString()).text(Math.round(d.temp.max).toString() + "\xB0");
    $("#fe_low_temp" + i.toString()).text(Math.round(d.temp.min).toString() + "\xB0");
    skycons.remove("fe_day_icon" + i.toString());
    skycons.add("fe_day_icon" + i.toString(), getWxIcon(d.weather[0].icon));
    $("#fe_label" + i.toString()).text(getWxDay(i));
    height=(maxRange*(d.temp.max-d.temp.min)/actualRange).toFixed(4);
    top=(maxRange*(maxFound-d.temp.max)/actualRange).toFixed(4);
    $("#fe_temp_bar" + i.toString()).css("height", height.toString() + "px");
    $("#fe_temp_bar" + i.toString()).css("top", top.toString() + "px");
  }

  // start the icon animations
  skycons.play();
}

refreshPageContent = function() {
  console.log("refreshPageContent()");

  var d = new Date().getDay();
  if (d != lastReloadDay) {
    // force a full reload of the page
    console.log("Forced Reload since the day changed");
    location.reload();
  }

	//console.log(d);
  
  // clear current content...
  agendaItems = [];
  myCalEvents = [];
  if (myCalendar) {
    myCalendar.removeAllEvents();
  }

  // load the content the first time
  $.ajax({ url: "meals.ics", success: parseMealData, cache: false });
  $.ajax({ url: "family.ics", success: parseCalendarData, cache: false });
  $.ajax({ url: "holidays.ics", success: parseHolidayData, cache: false });
  $.ajax({ url: "hva.ics", success: parseHVAData, cache: false });
  $.ajax({ url: "local_weather.json", success: updateLocalWeather, cache: false });
  $.ajax({ url: "current_weather.json", success: updateCurrentWeather, cache: false });
  $.ajax({ url: "imagedata.json", success: updateImages, cache: false });

  // now let's schedule the next update...
  setTimeout(refreshPageContent, CURR_WEATHER_TIMEOUT);
}



/// This is the main entry point for this little application
loadCalendarData = function () {
  console.log("locaCalendarData()");

  startTime();
  refreshPageContent();

  // get the current date/time
  var thisMoment = moment();

  // load the data for the memory verse
  var memory_html = '<blockquote class="blockquote mb-0">';

  // let's loop through our memory verses
  for (var i = 0; i < family_verses.length; i++) {
    if (thisMoment.isBetween(family_verses[i].startDate, family_verses[i].endDate, '[]')) {
      memory_html += '<p>' + family_verses[i].text + '</p>';
      memory_html += '<footer class="blockquote-footer">' + family_verses[i].reference + '<cite title="CSB"> CSB </cite></footer>';
      break;
    }
  }
  $("#memoryVerse").html(memory_html);

  // now let's look at the daily Bible reading
  for (var i = 0; i < family_reading.length; i++) {
    if (thisMoment.isSame(family_reading[i].date, 'day')) {
      agendaItems.push({date: null, summary: "Bible Reading: " + family_reading[i].passage});
    }
  }

};

writeVerseData = function (json) {
  var votd = json.votd;
  var votd_html = '<blockquote class="blockquote mb-0">';
  votd_html += '<p>' + votd.text + '</p>';
  votd_html += '<footer class="blockquote-footer">' + votd.display_ref + '<cite title="CSB"> CSB </cite></footer>';
  votd_html += '</blockquote>';
  $("#dailyVerse").html(votd_html);
};


