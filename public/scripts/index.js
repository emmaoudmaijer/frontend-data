const url = "https://api.data.netwerkdigitaalerfgoed.nl/datasets/ivo/NMVW/services/NMVW-09/sparql"
const queryStart = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX edm: <http://www.europeana.eu/schemas/edm/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?cat ?catLabel (COUNT(?cho) AS ?choCount) (SAMPLE(?afb) AS ?afbSample)
WHERE {
`;

//geef subtypes van ruilmiddelen
let termMaster = `
  <https://hdl.handle.net/20.500.11840/termmaster12591> skos:narrower/skos:narrower ?cat .
`;

const queryEnd = `
  ?cat skos:prefLabel ?catLabel .

  # geef de subcategorieen van ruilmiddelen
  ?cat skos:narrower* ?type .

  # geef objecten bij de onderliggende types
  ?cho edm:object ?type . 
  
    ?cho edm:isShownBy ?afb .
  
} GROUP BY ?cat ?catLabel
`;

let query = queryStart + termMaster + queryEnd;
//let newResults = [];


function runSPARQL() {
	fetch(url + "?query=" + encodeURIComponent(query) + "&format=json") //omzetten naar json en geschikt maken voor de het ophalen uit browser
		.then(data => data.json())
		.then(json => {
			const newResults = json.results.bindings
				.map(result => {
					return {
						category: result.catLabel.value,
						value: Number(result.choCount.value),
						foto: result.afbSample.value
					}
				})
			drawChart(newResults)
			
		})
	
}

function drawChart(results) {
	let svg = d3.select('svg');
	//hoe breed en hoe hoog wordt de visualisatie?
	const margin = 80;
	const width = 1000 - 2 * margin;
	const height = 580 - 2 * margin;

	const chart = svg.append('g')
		.attr('transform', `translate(${margin}, ${margin})`);
	//x-as schaal

	let animation = d3.transition()
		.duration(700)
		.ease(d3.easePoly);

	results.sort(function(a, b) {
		return d3.descending(a.value, b.value)
	})

	const xScale = d3.scaleBand()
		.range([0, width])
		.domain(results.map((s) => s.category))
		.padding(0.4)

	//y-as schaal Bron: https://www.d3indepth.com/scales/
	let yScale = d3.scaleSqrt() //scaleSqrt toegevoegd omdat de data te ver uit elkaar lag, om zo een beter overzicht te geven
		.exponent(0.5)
		.range([height, 0])
		.domain([0, d3.max(results.map((s) => s.value))]).nice()

	const makeYLines = () => d3.axisLeft()
		.scale(yScale)

	// Nieuwe groep, horizontale lijn x-as tekenen
	chart.append('g')
		.attr('transform', `translate(0, ${height})`)
		.call(d3.axisBottom(xScale));

	// Nieuwe groep, verticale lijn y-as tekenen
	chart.append('g')
		.call(d3.axisLeft(yScale));
		
	//grid maken op achtergrond bar chart
	chart.append('g')
		.attr('class', 'grid')
		.call(makeYLines()
		.tickSize(-width, 0, 0)
		.tickFormat('')
		)
	// data aanroepen, versturen en groeperen
	const categoryBar = chart.selectAll()
		.data(results)
		.enter()
		.append('g')

	console.log(results)

	categoryBar
		.append('rect')
		.attr('class', 'bar')
		.attr('y', (g) => yScale(g.value))
		.attr('x', (g) => xScale(g.category))
		.attr('height', (g) => height - yScale(g.value))
			.transition()
			.duration(750)
			.delay((g, i) => { return i * 150; })
		.attr('width', xScale.bandwidth())
		// hover loslaten , geen opacity

	categoryBar
		.on('mouseenter', function (actual, i, category) {
			//d3.select('.bar')
			d3.select('value')
				.attr('opacity', 0) //weghalen van de bar

			d3.select(this)
				.transition()
				.duration(300)
				.attr('opacity', 0.6) //terugzetten van de bar transparant
				.attr('x', (a) => xScale(a.category) - 5)
				.attr('width', xScale.bandwidth() + 10)
				  
			const y = yScale(actual.value)
			// Bron bij tooltip: https://wattenberger.com/blog/d3-interactive-charts
			const tooltip = d3.select("#tooltip")
			tooltip
				.style("opacity", 1)
				.select("#range")
				.html([ 
					 "Categorie: " + (actual.category + "<br>" + "<img src=" + actual.foto + " width= 100px; height= 100px />") 
					 + "<p>Items in de collectie:</p>" + (actual.value) + " Items"
				].join(" ")) //waardes meegeven aan de tooltip

			// LIJN BOVEN DE BAR CHARTS VOOR EEN DUIDELIJK OVERZICHT
				line = chart.append('line')
				.attr('id', 'limit')
				.attr('x1', 0)
				.attr('y1', y)
				.attr('x2', width)
				.attr('y2', y)								
		})
		//hover loslaten , geen opacity
		.on('mouseleave', function () {
			//d3.select('.bar')
			 d3.select('.value')
				.attr('opacity', 1)

			 d3.select(this)
				.transition()
				.duration(300)
				.attr('opacity', 1)
				.attr('x', (a) => xScale(a.category))
				.attr('width', xScale.bandwidth())

			chart.selectAll('#limit').remove()
			const tooltip = d3.select("#tooltip")
			tooltip
				.style("opacity", 0) //hover loslaten , geen opacity
		})

	categoryBar
		.append('text')
		.attr('x', (a) => xScale(a.category) + xScale.bandwidth() / 2)
			.transition()
			.duration(750)
			.delay((g, i) => { return i * 150; })
		.attr('y', (a) => yScale(a.value) + 40)
		.attr('text-anchor', 'middle')
		.text((a) => `${a.value}`)

	svg
		.append('text')
		.attr('class', 'label')
		.attr('x', -(height / 2) - margin)
		.attr('y', margin / 2.4)
		.attr('transform', 'rotate(-90)')
		.attr('text-anchor', 'middle')
		.text('Aantal ruilmiddelen')

	svg.append('text')
		.attr('class', 'label')
		.attr('x', width / 2 + margin)
		.attr('y', height + margin * 1.7)
		.attr('text-anchor', 'middle')
		.text('categorie')

	svg.append('text')
		.attr('class', 'title')
		.attr('x', width / 2 + margin)
		.attr('y', 40)
		.attr('text-anchor', 'middle')
		.text('Uit welke ruilmiddelen bestaat de collectie van het NMWC?')

	function update(){
			termMaster = `
			<https://hdl.handle.net/20.500.11840/termmaster12596> skos:narrower ?cat .
			`;
		query = queryStart + termMaster + queryEnd;
		newData = query 
		console.log(newData)
		
		d3.selectAll("button").remove();
	
		d3.selectAll("g")
			.enter()
			.data(runSPARQL(newData))

		d3.selectAll("g").data(results)
			.exit().remove();
		d3.selectAll("text")
		.remove();

	}
	let button = d3.select("#container").append('button')
	let button2 = d3.select("#container").append('button')
	button
		.text('Alle ruilmiddelen')
		.on('click', function(){
			termMaster = `
			<https://hdl.handle.net/20.500.11840/termmaster12591> skos:narrower/skos:narrower ?cat .
			 `;
			query = queryStart + termMaster + queryEnd;
			d3.selectAll("button").remove();
	
			d3.selectAll("g")
				.enter()
				.data(runSPARQL(query))

			d3.selectAll("g").data(newData)
				.remove();
			d3.selectAll("text")
			.remove();
		})

	button2
	.text('Munten')
	.on('click', update)
}

runSPARQL()