// Define global variables
const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%Y-%m-%d");
const startDate = parseDate('2020-01-13');
const endDate = parseDate('2021-03-07');
const dates = d3.timeDays(startDate, endDate);

let positiveData, deathData, populationData, positiveCasesData, deathCasesData;

Promise.all([
    d3.json('gz_2010_us_040_00_500k.json'),
    d3.csv('Positive_Percentage.csv'),
    d3.csv('Death_Percentage.csv'),
    d3.csv('Population.csv'),
    d3.csv('Positive.csv'),
    d3.csv('Death.csv')
]).then(function([geoData, positiveCSV, deathCSV, populationCSV, positiveCasesCSV, deathCasesCSV]) {
    positiveData = positiveCSV;
    deathData = deathCSV;
    populationData = populationCSV;
    positiveCasesData = positiveCasesCSV;
    deathCasesData = deathCasesCSV;

    // Convert positive data to a more usable format
    positiveData.forEach(d => {
        for (let key in d) {
            if (key !== "state") {
                d[key] = +d[key] * 100; // Convert to percentage
            }
        }
    });

    // Initialize the map and slider
    initMap(geoData);
    initSlider();
    updateMap(dates[0]); // Initialize the map with the first date's data
});

function initMap(geoData) {
    const width = document.getElementById('map').offsetWidth;
    const height = document.getElementById('map').offsetHeight;
    const projection = d3.geoAlbersUsa().scale(1000).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.selectAll("path")
        .data(geoData.features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "state")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "orange");
            showPieChart(event, d.properties.NAME);
        })
        .on("mouseout", function(event, d) {
            updateMap(dates[d3.select("#time-slider").node().value]); // Revert to the current date's color on mouse out
            d3.select("#piechart-tooltip").classed("hidden", true);
        });
}

function initLegend() {
    const legendWidth = 500;
    const legendHeight = 100;

    const svg = d3.select("#legend")
        .attr("width", legendWidth)
        .attr("height", legendHeight);

    const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "gradient")
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.interpolateBlues(0));
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.interpolateBlues(1));

    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", 10)
        .style("fill", "url(#gradient)");

    const xScale = d3.scaleLinear()
        .domain([0, 15]) // 与 colorScale 的 domain 相同
        .range([0, legendWidth]);

    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => d + "%");

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, 10)")
        .call(xAxis);

    svg.append("text")
        .attr("class", "legend-title")
        .attr("x", legendWidth / 2)
        .attr("y", 40)
        .attr("text-anchor", "middle")
        .text("Positive Percentage of the State");
}

initLegend();


function initSlider() {
    const slider = d3.select("#time-slider")
        .attr("min", 0)
        .attr("max", dates.length - 1)
        .attr("value", 0)
        .on("input", function() {
            const date = dates[this.value];
            d3.select("#current-date").text(formatDate(date));
            updateMap(date); // Update the map based on the current slider date
        });

    slider.node().value = 0;
    d3.select("#current-date").text(formatDate(dates[0]));
}

function updateMap(date) {
    const currentDate = formatDate(date);
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, 10]); // Adjust the color scale based on the data range

    d3.selectAll(".state")
        .attr("fill", function(d) {
            const state = d.properties.NAME;
            const positivePercentage = positiveData.find(p => p.state === state)[currentDate];
            return positivePercentage !== undefined ? colorScale(positivePercentage) : "#ccc";
        });
}

function showPieChart(event, state) {
    const dateIndex = d3.select("#time-slider").node().value;
    const currentDate = formatDate(dates[dateIndex]);

    const positiveCases = positiveCasesData.find(d => d.state === state)[currentDate];
    const deathCases = deathCasesData.find(d => d.state === state)[currentDate];
    const population = populationData.find(d => d.State === state).Population;

    const positivePercentage = (positiveCases / population) * 100;
    const deathPercentage = (deathCases / population) * 100;
    const nonPositivePercentage = 100 - positivePercentage;

    const data = [
        { label: "Non-Positive", value: nonPositivePercentage },
        { label: "Positive", value: positivePercentage },
        { label: "Death", value: deathPercentage }
    ];

    const radius = Math.min(250, 250) / 2;
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.label))
        .range(["lightgray", "#1f77b4", "#ff7f0e"]);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    const svg = d3.select("#piechart")
        .attr("width", 300)
        .attr("height", 300);

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${radius},${radius})`);

    g.selectAll("path")
        .data(pie(data))
        .enter().append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.label));

    g.selectAll("text")
        .data(pie(data))
        .enter().append("text")
        .attr("transform", function(d, i) {
            const pos = arc.centroid(d);
            if (i === 1) pos[1] -= 15; // Adjust position for "Positive"
            if (i === 2) pos[1] += 15; // Adjust position for "Death"
            return `translate(${pos})`;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(d => d.data.label);

    d3.select("#piechart-data").html(`
        <p><strong>State:</strong> ${state}</p>
        <p><strong>Population:</strong> ${population}</p>
        <p><strong>Positive Cases:</strong> ${positiveCases}</p>
        <p><strong>Death Cases:</strong> ${deathCases}</p>
    `);

    d3.select("#piechart-tooltip")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px")
        .classed("hidden", false);
}
