/*
 Vue.js Geocledian maturity-chart component
 created: 2021-11-24, jsommer
 updated: 2021-11-25, jsommer
 version: 0.1.0
*/
"use strict";

Date.prototype.simpleDate = function () { 
  var a = this.getFullYear(),
    b = this.getMonth() + 1,
    c = this.getDate();
  return a + "-" + (1 === b.toString().length ? "0" + b : b) + "-" + (1 === c.toString().length ? "0" + c : c)
}

//language strings
const gcMaturitychartLocales = {
  "en": {
    "options": { "title": "Maturity chart" },
    "product": "Harvest Maturity",
    "description": { 
      "id": "ID",
      "parcel": "Parcel",
    },
    "chart": {
      "no_data_msg" : "No data available"
    }
  },
  "de": {
    "options": { "title": "Reife Graph" },
    "product": "Reife",
    "description": { 
      "id": "Nr",
      "parcel": "Feld",
    },
    "chart": {
      "no_data_msg" : "Keine Daten verfügbar",
    }
  },
}

Vue.component('gc-maturity-chart', {
  props: {
    gcWidgetId: {
      type: String,
      default: 'maturity-chart1',
      required: true
    },
    gcMaturityData: {
      type: Array,
      default: []
    },
    gcMode: {
      type: String,
      default: "line" // "line" or "spline"
    },
    gcAvailableOptions: {
      type: String,
      default: "title,legend" // available options
    },
    gcWidgetCollapsed: {
      type: Boolean,
      default: true // or true
    },
    gcLanguage: {
      type: String,
      default: 'en' // 'en' | 'de'
    },
    gcSelectedDate: { 
      type: String,
      default: ''
    },
    gcYScale: {
      type: String,
      default: 'fixed' // 'fixed' //dynamic or fixed y scale
    },
    gcWhiteLabel: {
      type: Boolean,
      default: false // true or false
    },
    gcZoomDomain:  {
      type: String,
      default: [] // array with ISO date strings, e.g. ['2018-03-01', '2018-09-01']
    },
  },
  template: `<div :id="gcWidgetId" class="gc-maturity-chart">       

              <p class="gc-options-title is-size-6 is-orange" style="cursor: pointer;" 
                v-on:click="toggleMaturitychart"   
                v-show="this.availableOptions.includes('title')">
                {{ $t('options.title') }}
                <i :class="[gcWidgetCollapsed ? '': 'is-active', 'fas', 'fa-angle-down', 'fa-sm']"></i>
              </p>
              <div :class="[gcWidgetCollapsed ? '': 'is-hidden']">
               <div class="is-flex">
                <div class="is-grey" v-show="this.availableOptions.includes('description')">
                </div>

                </div>
                <!-- watermark -->
                <div :class="[this.gcWhiteLabel ? 'is-hidden': 'is-inline-block', 'is-pulled-right']"
                  style="opacity: 0.65;">
                  <span style="vertical-align: top; font-size: 0.7rem;">powered by</span><br>
                  <img src="img/logo.png" alt="geo|cledian" style="width: 100px; margin: -10px 0;">
                </div>
               </div>

                <div :id="'chartNotice_'+gcWidgetId" class="content is-hidden"></div>

                <div :id="'chartSpinner_'+gcWidgetId" class="chartSpinner maturity-chart-spinner is-hidden"  style="max-height: 50px!important;">
                  <div class="rect1"></div>
                  <div class="rect2"></div>
                  <div class="rect3"></div>
                  <div class="rect4"></div>
                  <div class="rect5"></div>
                </div>

                <div style="position: relative;">
                  <div :id="'chart_'+gcWidgetId" class="gc-maturity-chart">
                  </div>
                  <div :id="'chartlegend_'+gcWidgetId"></div>
                </div>
              </div>
          </div>
          <!-- chart -->`,
  data: function () {
    return {
      chart: undefined,
      chartSelectedDate: null,
      maxDaysOff: 7 // max days offset from querydate to activate selection
    }
  },
  computed: {
    // chartWidth: function() {
    //     console.debug("clientwidth "+document.getElementById(this.gcWidgetId).clientWidth);
    //     console.debug("offsetwidth "+document.getElementById(this.gcWidgetId).offsetWidth);
    //     return parseInt(document.getElementById(this.gcWidgetId).offsetWidth);
    // },
    // chartHeight: function() {
    //     console.debug("clientheight "+document.getElementById(this.gcWidgetId).clientHeight);
    //     console.debug("offsetheight "+document.getElementById(this.gcWidgetId).offsetHeight);
    //     //return parseInt(document.getElementById(this.gcWidgetId).offsetHeight);
    //     return parseInt(document.getElementById(this.gcWidgetId).style.height);
    // },
    availableOptions: {
      get: function() {
        return (this.gcAvailableOptions.split(","));
      }
    },
    currentLanguage: {
      get: function() {
        // will always reflect prop's value 
        return this.gcLanguage;
      },
    },
    selectedDate: {
      get: function() {
        return this.gcSelectedDate;
      },
      set: function(value) {
        console.debug("selectedDate - setter: "+value);
        // emitting to root instance 
        this.$root.$emit("queryDateChange", value);
      }
    },
  },
  i18n: { 
    locale: this.currentLanguage,
    messages: gcMaturitychartLocales
  },
  created: function () {
    console.debug("maturity-chart! - created()");
    try {
      this.changeLanguage();
    }
    catch (ex) 
    {
      console.error(ex);
    }
  },
  /* when vue component is mounted (ready) on DOM node */
  mounted: function () {

    document.getElementById("chartSpinner_" + this.gcWidgetId).classList.remove("is-hidden");

    // listen on size change handler
    this.$root.$on("containerSizeChange", this.containerSizeChange);

    /* init empty chart */
    this.chart = bb.generate({
      bindto: '#chart_'+this.gcWidgetId,
      data: {
        x: 'x',
        columns: [],
        empty: {
          label: {
              text: this.$t("chart.no_data_msg")
          }
        }
      },
      grid: {
        x: {
            show: true
        },
        y: {
            show: true
        }
      },
      axis: {
        x: {
            type: 'timeseries',
            tick: {
                fit: false,
                format: "%e %b %y"
            }
        },
        y: {
            label: { text: '\n                                          \n\n',
                    position: 'outer-top'},
            max: 100,
            min: 0,
            padding: {top:10, bottom:0}
        }
      }
    });

    //initial loading data
    if (this.gcParcelId > 0) {
      this.currentParcelID = this.gcParcelId;
      this.handleCurrentParcelIDchange();
    }
  },
  watch: {
    gcMaturityData (newValue, oldValue) {
      this.createChartData();
    },
    currentLanguage(newValue, oldValue) {
      this.changeLanguage();
      //rebuild chart if language changed, otherwise localization will not refresh
      this.createChartData();
    },
    gcMode(newValue, oldValue) {
      this.createChartData();
    },
    gcSelectedDate(newValue, oldValue) {
      console.debug("event - gcSelectedDate");

      console.log(newValue, oldValue)
      console.log(this.chartSelectedDate)

      if (this.chartSelectedDate !== newValue) {
        let index = this.getClosestTimeSeriesIndex(this.gcMaturityData, newValue, this.maxDaysOff);
        
        // if found zoom to this date
        if (index >= 0) {
          // this will also trigger onselected event on the chart!
          this.chart.select("maturity", [index], true);
        }
        else {
          this.chart.unselect("maturity");
        }
      }
      else {
        console.debug("ALREADY selected date found!!")
        return; // already selected
      }
      console.log(this.chart.selected());
    },
    gcZoomDomain (newValue, oldValue) {
      console.debug("event - gcZoomDomain");
      // check for valid domain (fromDate < toDate)
      if (new Date(newValue[0]).getTime() < new Date(newValue[1]).getTime()) {  
        // TODO if date out of bounds reset or do nothing?
        // currently it does nothing

        // if (newValue[0] <= this.chart.axis.min().x) {

        // }
        this.chart.zoom(newValue);
        // notify root also
        this.$root.$emit('zoomDomainChange', newValue);
      }
    }
  },
  methods: {
    toggleMaturitychart: function () {
      this.gcWidgetCollapsed = !this.gcWidgetCollapsed;
    },
    createChartData: function() {

      console.debug("createChartData()");
  
      let columns = [];

      if (this.gcMaturityData.length > 0) {
        let dates = this.gcMaturityData.filter(m=>m.mean !== null).map(m => m.date);
        let filteredStats = this.gcMaturityData.filter(m=>m.mean !== null).map(m => this.formatDecimal(m.mean,2));

          // format values to 2 decimals
          columns[0] = ["x"].concat(dates);
          columns[1] = ["maturity"].concat(filteredStats);
        }

        document.getElementById("chartSpinner_" + this.gcWidgetId).classList.add("is-hidden");
        document.getElementById("chart_" + this.gcWidgetId).classList.remove("is-hidden");
        document.getElementById("chartNotice_"+this.gcWidgetId).classList.add("is-hidden");

        this.createChart(columns);

    },
    createChart: function(data) {

      console.debug(data);

      let color_options = {
        "maturity": '#d7191c'
      };
      // let xs_options = {
      //   "maturity": "x",
      // };
      let ys_options = {
        "max": this.gcYScale == 'dynamic' ? undefined : 100,
        "min": this.gcYScale == 'dynamic' ? undefined : 0,
      };
      let axis_label = this.$t("product");
      //set i18n for time x axis
      // d3.timeFormatDefaultLocale(this.d3locales[this.currentLanguage]);

      this.chart = bb.generate({
        bindto: '#chart_'+this.gcWidgetId,
        // size: {
        //   width: this.chartWidth,  
        //   height: this.chartHeight
        // },
        data: {
          selection: {
            enabled: true,
            multiple: false,
            grouped: false,
          },
          // single x axis
          x: 'x',
          // multiple x axis mapping
          // xs: xs_options,
          columns: [],
          names: {
            "maturity": this.$t('product'),
          },
          empty: {
            label: {
                text: this.$t("chart.no_data_msg")
            }
          },
          type: this.gcMode, 
          colors: color_options,
          onselected: function(e, svgElement, b, c) {
            console.debug("gc-maturity-chart onselected()");

            if (e.x) {
              // internal "click" date
              this.chartSelectedDate = e.x.simpleDate();

              // may be set from outside of this widget
              this.selectedDate = e.x.simpleDate();
            }
            
          }.bind(this),
        },
        //nicer splines, default is "cardinal"
        spline: {
          interpolation: {
            type: 'monotone'
          }
        },
        //color: color_options,
        transition: {
            duration: 300
        },
        legend: {
          show: this.availableOptions.includes('legend'),
        },
        line: {
          connectNull: true
        },
        point: {
          show: true,  //show data points in line chart
          //r: 3, //radius of points in line chart
          focus: {
              expand: {
                r: 6
              }
          },
          // issue in billboard 3.1.5: value will override opacity for any point (even for null values)
          // will be fixed with https://github.com/naver/billboard.js/blob/6ff9aec01d831c8fe2449da6b87121281829f209/src/ChartInternal/shape/point.ts#L42
          opacity: 1.0, 
          // size dependent of source
          r: function (d) {
            // workaround for opacity issue
            // set radius to 0 if we have a null value
            if (d.value == null) {
              return 0;
            }
            return 3; //default
          }
        },
        transition: {
          duration: 300
        },
        grid: {
          x: {
              show: true
          },
          y: {
              show: true
          }
        },
        axis: {
          x: {
            type: 'timeseries',
            tick: {
              rotate: 60,
              multiline: true,
              //format: '%d.%m.%Y',
              fit: false, //false means evenly spaced- ticks - otherwise the time spans will be honored between dates 
              format: "%e %b %y"
              //format: function (x) { return x.getFullYear(); }
            },
              //timeseries -> milliseconds as units; 1814400000 -> 3 weeks
            padding: {
              right: 1814400000,
              left: 1814400000
            },
          },
          y: {
            label: {text: axis_label,
                    position: 'outer-top'},
            // fixed values vs dynamically scaling
            max: ys_options["max"],
            min: ys_options["min"],
            padding: {top:10, bottom:0}
          },
        },
        zoom: {
          enabled: true, //only by chartFrom and chartTo fields!
          type: 'drag', // 'wheel'
        },
        tooltip: {
          grouped: true,
          format: {
            /*title: function(x) {
                return x.toISOString().split("T")[0];
            },*/
            name: function(name, ratio, id, index) { 
              return name; 
            },
            // value: function(value, ratio, id, index) {
            //   return value + "%";
            // }
          }
        }
      });

      // toggles animation of chart
      this.chart.load({
        columns: data, 
        done: function() {
          setTimeout( function() {
            this.chart.resize();
          }.bind(this), 100);
        }.bind(this)
      });
    },
    containerSizeChange(size) {
      /* handles the resize of the map if parent container size changes */
      console.debug("containerSizeChange - gc-maturity-chart");
      this.chart.resize();
    },
    /* GUI helper */
    changeLanguage() {
      this.$i18n.locale = this.currentLanguage;
    },
    getClosestDate: function (arr, queryDate) {
      console.debug("getClosestDate()");
      /* Returns the closest date in a array of dates
         with the sort function */
      let i = arr.sort(function(a, b) {
        var distancea = Math.abs(queryDate - a);
        var distanceb = Math.abs(queryDate - b);
        return distancea - distanceb; // sort a before b when the distance is smaller
      });
      return i[0];
    },
    getClosestTimeSeriesIndex: function (timeseries, queryDate, maxDaysOff) {
      /* returns the nearest Date to the given parcel_id and query date */
      console.debug("getClosestTimeSeriesIndex()");

      const closestDate = this.getClosestDate(timeseries.map(d => new Date(d.date)), new Date(queryDate));

      if (closestDate !== undefined) {
        // don't return for values with distance > maxDaysOff days
        if ( Math.abs(new Date(queryDate) - closestDate) <= (maxDaysOff * 86400000) ) {
          console.debug("closest date of given date "+ queryDate + " is "+ closestDate.simpleDate() + " within " + maxDaysOff + " days");
          // find the index of the closest date in timeseries now
          return timeseries.map(d => d.date).indexOf(closestDate.simpleDate());
        }
        else {
          console.debug("no closest date of given date "+ queryDate + " found within " + maxDaysOff + " days");
        }
      }
    },  
    /* helper functions */
    removeFromArray: function(arry, value) {
      let index = arry.indexOf(value);
      if (index > -1) {
          arry.splice(index, 1);
      }
      return arry;
    },
    formatDecimal: function(decimal, numberOfDecimals) {
      /* Helper function for formatting numbers to given number of decimals */
  
      var factor = 100;
  
      if ( isNaN(parseFloat(decimal)) ) {
          return NaN;
      }
      if (numberOfDecimals == 1) {
          factor = 10;
      }
      if (numberOfDecimals == 2) {
          factor = 100;
      }
      if (numberOfDecimals == 3) {
          factor = 1000;
      }
      if (numberOfDecimals == 4) {
          factor = 10000;
      }
      if (numberOfDecimals == 5) {
          factor = 100000;
      }
      return Math.ceil(decimal * factor)/factor;
    },
    capitalize: function (s) {
      if (typeof s !== 'string') return ''
      return s.charAt(0).toUpperCase() + s.slice(1)
    },
    isDateValid: function (date_str) {
      /* Validates a given date string */
      if (!isNaN(new Date(date_str))) {
          return true;
      }
      else {
          return false;
      }
    },
    loadJSscript: function (url, callback) {
      
      let script = document.createElement("script");  // create a script DOM node
      script.src = gcGetBaseURL() + "/" + url;  // set its src to the provided URL
      script.async = true;
      console.debug(script.src);
      document.body.appendChild(script);  // add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
      script.onload = function () {
        callback();
      };
    },

    showMsg : function (msg) {
      try { document.getElementById("sDate_"+this.gcWidgetId).classList.add("is-hidden"); } catch (ex) {}
      try { document.getElementById("desc_" + this.gcWidgetId).classList.add("is-hidden"); } catch (ex) {}

      if(msg === 'key is not authorized'){
        document.getElementById("chartNotice_" + this.gcWidgetId).innerHTML = "Sorry, the given API key is not authorized!<br> Please contact <a href='https://www.geocledian.com'>geo|cledian</a> for a valid API key.";
      }
      else if(msg === 'api key validity expired'){
        document.getElementById("chartNotice_" + this.gcWidgetId).innerHTML = "Sorry, the given API key's validity expired!<br> Please contact <a href='https://www.geocledian.com'>geo|cledian</a>for a valid API key.";
      } else{
        document.getElementById("chartNotice_" + this.gcWidgetId).innerHTML = "Sorry, an error occurred!<br>Please check the console log for more information.";
      }

      document.getElementById("chartNotice_" + this.gcWidgetId).classList.remove("is-hidden");
      document.getElementById("chartSpinner_" + this.gcWidgetId).classList.add("is-hidden");
    },

   hideMsg : function (msg) {
      try { document.getElementById("sDate_"+this.gcWidgetId).classList.remove("is-hidden"); } catch (ex) {}
      try { document.getElementById("desc_" + this.gcWidgetId).classList.remove("is-hidden"); } catch (ex) {}
      document.getElementById("chartNotice_"+this.gcWidgetId).classList.add("is-hidden");
      document.getElementById("chart_" + this.gcWidgetId).classList.add("is-hidden");
      document.getElementById("chartSpinner_" + this.gcWidgetId).classList.remove("is-hidden");
    }
  }
});