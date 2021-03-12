// https://github.com/mifi/ical-expander

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
  console.log(agendaItems.length);
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
  console.log("Trying to do the holidays...")
  holidayEvents = {
    events: []
  };

  // figure out today...
  var today = '';
  var d = new Date();
  var curr_year = d.getFullYear();
  var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
  var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';
  var beforeString = curr_year.toString() + '-' + (curr_month + 1).toString() + '-01';
  if (curr_month + 1 === 13) {
    beforeString = (curr_year + 1).toString() + '-01-01';
  }

  // get the events for the current month
  const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
  const results = icalExpander.between(new Date(afterString), new Date(beforeString));
  const mappedEvents = results.events.map(e => ({ startDate: e.startDate, endDate: e.endDate, duration: e.duration, summary: e.summary }));
  const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
  const allEvents = [].concat(mappedEvents, mappedOccurrences);

  var count = allEvents.length;
  console.log("Found " + String(count) + " holiday(s)");
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


// global event list
var myCalEvents = [];
var agendaItems = [];
var todaysReading = 'not_set';

parseCalendarData = function (data) {

  // var today = '';
  var d = new Date();
  var curr_year = d.getFullYear();
  var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
  var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';
  var beforeString = curr_year.toString() + '-' + (curr_month + 1).toString() + '-01';
  if (curr_month + 1 === 13) {
    beforeString = (curr_year + 1).toString() + '-01-01';
  }

  // try the new approach
  const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
  const results = icalExpander.between(new Date(afterString), new Date(beforeString));
  const mappedEvents = results.events.map(e => ({ startDate: e.startDate, endDate: e.endDate, duration: e.duration, summary: e.summary }));
  const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
  const allEvents = [].concat(mappedEvents, mappedOccurrences);

  var curr_date_string = d.toDateString();
  
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
        color: '#4db8ff',
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


/// This is the main entry point for this little application
loadCalendarData = function () {

  startTime();

  $.ajax({ url: "meals.ics", success: parseMealData, cache: false });
  $.ajax({ url: "family.ics", success: parseCalendarData, cache: false });
  $.ajax({ url: "holidays.ics", success: parseHolidayData, cache: false });

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
