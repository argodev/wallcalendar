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








var todaysReading = 'not_set';

// TODO: Can we ghost/gray out the events for days that have already past?
// TODO: handle cancellations in recurring events?
// UID:6gomad1j6th38bb16kom6b9kcdh6cb9o6dgm8bb1c5j6cd32clhj4e9j6o@google.com is the same

parseCalendarData = function(data) {

    // set up the calendar view object
    var calendarEl = document.getElementById('calendar');
    var calendar = new FullCalendar.Calendar(calendarEl, {
      plugins: [ 'interaction', 'dayGrid', 'list' ],
      header: {
        left: '',
        center: 'title',
        right: ''
      },
      displayEventTime: true, // don't show the time column in list view
    });

    var today = '';
    var d = new Date();
    var curr_year = d.getFullYear();
    var curr_month = d.getMonth() + 1; // month returned is 0-based, so we add 1
    var afterString = curr_year.toString() + '-' + curr_month.toString() + '-01';
    var beforeString = curr_year.toString() + '-' + (curr_month + 1).toString() + '-01';
    if (curr_month+1 === 13) {
      beforeString = (curr_year + 1).toString() + '-01-01';
    }
    console.log(afterString);
    console.log(beforeString);

    // try the new approach
    const icalExpander = new IcalExpander({ ics: data, maxIterations: 1000 });
    const results = icalExpander.between(new Date(afterString), new Date(beforeString));
    const mappedEvents = results.events.map(e => ({ startDate: e.startDate, summary: e.summary }));
    const mappedOccurrences = results.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary }));
    const allEvents = [].concat(mappedEvents, mappedOccurrences);
    //console.log(allEvents.map(e => `${e.startDate.toJSDate().toISOString()} - ${e.summary}`).join('\n'));

    // var after = new Date(curr_year.toString() + '-' + curr_month.toString() + '-01');
    // console.log(after.toDateString());
    var curr_date_string = d.toDateString();
    var agendaItems = [];

    // loop through each event found
    allEvents.forEach(function(item) {

      var item_jsdate = item.startDate.toJSDate();

      // put the item on the calendar
      // if the item is *before* today...
      if (item_jsdate < d) {
        calendar.addEvent({
          title: item.summary,
          start: item_jsdate,
          allDay: false,
          color: '#e6e6e6',
          textColor: '#ccc'
        });
      } else {
        calendar.addEvent({
          title: item.summary,
          start: item_jsdate,
          allDay: false,
          color: '#4db8ff'
        });
      }


      // if the item is today, let's add it to the agenda list
      if (item_jsdate.toDateString() === curr_date_string) {
          // place new item at the top of the list
          agendaItems.push({
              date: item_jsdate,
              summary: item_jsdate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' - ' + item.summary
          });
      }

    });
    
    // do we need to sort these items?
    var x = agendaItems.sort(function(a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return a.date - b.date;
    });

    // now, let's loop through our array and build our html
    for (var i = 0; i < agendaItems.length; i++) {
        today += '<h5 class="card-title">' + agendaItems[i].summary + '</h5>';
    }

    // add to the agenda
    today += '<h5 class="card-title">Bible Reading: ' + todaysReading + '</h5>'; 

    // render the calendar
    calendar.render();

    // render the daily agenda
    //$("#dailyAgenda").html(today);
    $(today).prependTo('#dailyAgenda');
};

parseMealData = function(data) {
    // convert to JSON since that is how I think better
    var jcalData = ICAL.parse(data);
    var vcalendar = new ICAL.Component(jcalData);
    var vevents = vcalendar.getAllSubcomponents('vevent');

    var today = '<h5 class="card-title">Not yet selected</h5>';
    var d = new Date();

    vevents.forEach(function(item) {
        var event = new ICAL.Event(item); 
        //console.log(event.summary, event.uid, event.description);
        // Get start and end dates as local time on current machine
        //console.log(event.startDate.toJSDate());
        var startDate = event.startDate.toJSDate();
        if (startDate.toDateString() === d.toDateString()) {
            today = '<h5 class="card-title">Dinner: ' + item.getFirstPropertyValue('summary') + '</h5>';
        }
    });

    //$("#dinnerMenu").html(today);
    $(today).appendTo('#dailyAgenda');
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
    if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
    return i;
}


/// This is the main entry point for this little application
loadCalendarData = function() {
    console.log('Loading calendar data...');

    startTime();

    $.ajax({url: "meals.ics", success: parseMealData, cache: false});
    $.ajax({url: "family.ics", success: parseCalendarData, cache: false});

    // get the current date/time
    var thisMoment = moment();

    // load the data for the memory verse
    var memory_html = '<blockquote class="blockquote mb-0">';
    //var todaysDate = new Date();

    // let's loop through our memory verses
    for (var i = 0; i < family_verses.length; i++) {
        if (thisMoment.isBetween(family_verses[i].startDate, family_verses[i].endDate, '[]')) {
            memory_html += '<p>' + family_verses[i].text + '</p>';
            memory_html += '<footer class="blockquote-footer">' + family_verses[i].reference + '<cite title="CSB"> CSB </cite></footer>';
            break;
        }        
        // if (todaysDate > Date.parse(family_verses[i].startDate) && (todaysDate < Date.parse(family_verses[i].endDate))) {
        //     memory_html += '<p>' + family_verses[i].text + '</p>';
        //     memory_html += '<footer class="blockquote-footer">' + family_verses[i].reference + '<cite title="CSB"> CSB </cite></footer>';
        //     break;
        // }
    }
    $("#memoryVerse").html(memory_html);

    // now let's look at the daily Bible reading
    for (var i = 0; i < family_reading.length; i++) {
        if (thisMoment.isSame(family_reading[i].date, 'day')) {
            console.log(family_reading[i].passage);
            todaysReading = family_reading[i].passage;
        }
    }
};

writeVerseData = function(json) {
    console.log(json);
    var votd = json.votd;
    var votd_html = '<blockquote class="blockquote mb-0">';
    votd_html += '<p>' + votd.text + '</p>';

    votd_html += '<footer class="blockquote-footer">' + votd.display_ref + '<cite title="CSB"> CSB </cite></footer>';
    votd_html += '</blockquote>';
    $("#dailyVerse").html(votd_html);
};
