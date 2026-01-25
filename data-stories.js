/**
 * Data Stories - Interactive Chart Visualization
 * Loads chart configurations and renders D3.js charts
 */

// Color palette for charts
const CHART_COLORS = [
    '#4a9eff', // Blue
    '#ff6b6b', // Coral
    '#4ecdc4', // Teal
    '#f6b15d', // Gold
    '#9b59b6', // Purple
    '#2ecc71', // Green
    '#e74c3c', // Red
    '#3498db', // Light Blue
];

// SVG Icons
const ICONS = {
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 3H8a2 2 0 0 0-2 2v14"/></svg>',
    bar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    stream: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    sunburst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>',
    sankey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h2v14H3z"/><path d="M19 5h2v14h-2z"/><path d="M5 7c4 0 4 4 7 4s3-4 7-4"/><path d="M5 12c4 0 4 3 7 3s3-3 7-3"/><path d="M5 17c4 0 4-2 7-2s3 2 7 2"/></svg>'
};

// Get chart type icon
function getChartIcon(chartType) {
    const typeMap = {
        'bar_chart_horizontal': 'bar',
        'bar_chart_vertical': 'bar',
        'bar_chart': 'bar',
        'donut_chart': 'pie',
        'pie_chart': 'pie',
        'streamgraph': 'stream',
        'map_point': 'map',
        'sunburst': 'sunburst',
        'sankey': 'sankey'
    };
    return ICONS[typeMap[chartType] || 'bar'];
}

// State
let chartConfigs = null;
let currentChartId = null;

// Initialize
async function init() {
    try {
        // Load chart configurations
        const response = await fetch('assets/data/chartconfigs.json');
        chartConfigs = await response.json();
        
        // Render theme navigation in sidebar
        renderThemeNav();
        
        // Check URL for specific chart
        const urlParams = new URLSearchParams(window.location.search);
        const chartId = urlParams.get('chart');
        
        if (chartId) {
            selectChart(chartId);
        } else if (chartConfigs.charts.length > 0) {
            // Show first available chart by default (excluding chart_03)
            const firstChart = chartConfigs.charts.find(c => c.chart_id !== 'chart_03');
            if (firstChart) {
                selectChart(firstChart.chart_id);
            }
        }
    } catch (error) {
        console.error('Fehler beim Laden der Chart-Konfigurationen:', error);
        showError('Daten konnten nicht geladen werden.');
    }
}

// Render theme navigation in sidebar (excludes chart_03 - Herkunft der Soldaten)
function renderThemeNav() {
    const container = document.getElementById('themeNav');
    if (!container || !chartConfigs) return;
    
    // Filter out chart_03 (Herkunft der Soldaten - map visualization)
    const availableCharts = chartConfigs.charts.filter(c => c.chart_id !== 'chart_03');
    
    container.innerHTML = availableCharts.map(chart => `
        <a class="ds-theme-item" data-chart="${chart.chart_id}" href="?chart=${chart.chart_id}" onclick="event.preventDefault(); selectChart('${chart.chart_id}')">
            ${getChartIcon(chart.chart_type)}
            <span>${chart.title_de || chart.title}</span>
        </a>
    `).join('');
}

// Select chart
async function selectChart(chartId) {
    currentChartId = chartId;
    
    // Update sidebar navigation state
    document.querySelectorAll('.ds-theme-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chart === chartId);
    });
    
    // Find chart config
    const chartConfig = chartConfigs.charts.find(c => c.chart_id === chartId);
    if (!chartConfig) return;
    
    // Update header
    document.getElementById('storyTitle').textContent = chartConfig.title_de || chartConfig.title;
    document.getElementById('storyDescription').textContent = chartConfig.description_de || chartConfig.description;
    document.getElementById('chartTitle').textContent = chartConfig.title_de || chartConfig.title;
    document.getElementById('chartSubtitle').textContent = `${chartConfig.row_count} Datenpunkte • ${chartConfig.chart_type.replace(/_/g, ' ')}`;
    
    // Update breadcrumb
    document.getElementById('currentThemeName').textContent = chartConfig.title_de || chartConfig.title;
    
    // Show loading
    const container = document.getElementById('chartContainer');
    container.innerHTML = '<div class="ds-chart-loading"><div class="ds-spinner"></div><p>Lade Daten...</p></div>';
    
    try {
        // Load chart data
        const response = await fetch(`assets/${chartConfig.data_file}`);
        const chartData = await response.json();
        
        // Render chart
        renderChart(chartConfig, chartData);
        
        // Update interpretation
        updateInterpretation(chartConfig, chartData);
        
    } catch (error) {
        console.error('Fehler beim Laden der Chart-Daten:', error);
        container.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Daten konnten nicht geladen werden.</p>';
    }
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('chart', chartId);
    window.history.pushState({}, '', url);
}

// Get container width reliably
function getContainerWidth() {
    const container = document.getElementById('chartContainer');
    const chartDiv = document.getElementById('d3Chart');
    
    // Try multiple sources for width
    let width = chartDiv?.clientWidth || 
                container?.clientWidth || 
                container?.offsetWidth ||
                document.querySelector('.ds-chart-section')?.clientWidth ||
                800;
    
    // Ensure minimum width
    return Math.max(width - 48, 400); // Account for padding
}

// Render chart based on type
function renderChart(config, data) {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '<div class="ds-chart" id="d3Chart" style="width: 100%; min-height: 400px;"></div>';
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        const chartType = config.chart_type;
    
    switch(chartType) {
        case 'bar_chart_horizontal':
            renderHorizontalBarChart(config, data);
            break;
        case 'bar_chart_vertical':
        case 'bar_chart':
            renderVerticalBarChart(config, data);
            break;
        case 'donut_chart':
        case 'pie_chart':
            renderDonutChart(config, data);
            break;
        case 'streamgraph':
            renderStreamgraph(config, data);
            break;
        case 'sunburst':
            renderSunburst(config, data);
            break;
        case 'map_point':
            renderMapPlaceholder(config, data);
            break;
        case 'sankey':
            renderSankey(config, data);
            break;
        default:
            renderHorizontalBarChart(config, data);
    }
    });
}

// Horizontal Bar Chart
function renderHorizontalBarChart(config, chartData) {
    const data = chartData.data;
    const container = document.getElementById('d3Chart');
    const width = getContainerWidth();
    const margin = { top: 20, right: 30, bottom: 40, left: 180 };
    
    // Determine if this is the special age/sex chart or a generic chart
    const yAxisKey = config.y_axis_key?.toLowerCase().replace(/\s+/g, '_') || '';
    const groupByKey = config.group_by?.toLowerCase() || '';
    const isAgeChart = yAxisKey === 'age_class' && groupByKey === 'sex';
    
    let categories, groups, groupLabels, grouped;
    
    if (isAgeChart) {
        // Special processing for age/sex chart
        grouped = d3.rollup(
            data,
            v => v.length,
            d => {
                const ageMin = parseInt(d.age_min) || 0;
                if (ageMin < 5) return '0-4';
                if (ageMin < 15) return '5-14';
                if (ageMin < 25) return '15-24';
                if (ageMin < 35) return '25-34';
                if (ageMin < 45) return '35-44';
                if (ageMin < 55) return '45-54';
                return '55+';
            },
            d => d.sex || 'indet'
        );
        categories = ['0-4', '5-14', '15-24', '25-34', '35-44', '45-54', '55+'];
        groups = ['w', 'm', 'indet'];
        groupLabels = { 'w': 'Weiblich', 'm': 'Männlich', 'indet': 'Unbestimmt' };
    } else {
        // Generic horizontal bar chart - group by y_axis_key
        const getCategoryValue = (d) => {
            // Try to find the category field
            const key = yAxisKey.replace(/_/g, '');
            return d[config.y_axis_key] || d[yAxisKey] || d[key] || 
                   d.legion || d.category || d.type || 'Unbekannt';
        };
        
        grouped = d3.rollup(data, v => v.length, d => getCategoryValue(d));
        
        // Convert to simple format and sort by count
        const simpleData = Array.from(grouped, ([key, value]) => ({ category: key, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 15); // Top 15
        
        // Render simple horizontal bar chart
        return renderSimpleHorizontalBarChart(container, simpleData, config, width, margin);
    }
    
    const height = 400;
    const processedData = [];
    categories.forEach(cat => {
        const catData = grouped.get(cat) || new Map();
        groups.forEach(group => {
            processedData.push({
                category: cat,
                group: group,
                value: catData.get(group) || 0
            });
        });
    });
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create tooltip
    const tooltip = d3.select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute');
    
    // Scales
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const y0 = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .paddingInner(0.2);
    
    const y1 = d3.scaleBand()
        .domain(groups)
        .range([0, y0.bandwidth()])
        .padding(0.05);
    
    const x = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1])
        .nice()
        .range([0, innerWidth]);
    
    const color = d3.scaleOrdinal()
        .domain(groups)
        .range([CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[2]]);
    
    // Create main group with margins
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Draw bars
    g.selectAll('g.category')
        .data(categories)
        .join('g')
        .attr('class', 'category')
        .attr('transform', d => `translate(0,${y0(d)})`)
        .selectAll('rect')
        .data(cat => groups.map(grp => ({
            category: cat,
            group: grp,
            value: (grouped.get(cat) || new Map()).get(grp) || 0
        })))
        .join('rect')
        .attr('class', 'bar')
        .attr('y', d => y1(d.group))
        .attr('x', 0)
        .attr('height', y1.bandwidth())
        .attr('width', d => Math.max(0, x(d.value)))
        .attr('fill', d => color(d.group))
        .attr('rx', 3)
        .on('mouseover', function(event, d) {
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`<strong>${d.category}</strong><br>${groupLabels[d.group]}: ${d.value}`)
                .style('left', (event.offsetX + 10) + 'px')
                .style('top', (event.offsetY - 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.transition().duration(500).style('opacity', 0);
        });
    
    // Y Axis
    g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y0))
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.7)')
        .style('font-size', '12px');
    
    // X Axis
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5))
        .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)'))
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.7)');
    
    // Legend
    renderLegend(groups.map(g => ({ label: groupLabels[g], color: color(g) })));
}

// Simple Horizontal Bar Chart (for generic data without groups)
function renderSimpleHorizontalBarChart(container, data, config, width, margin) {
    const height = Math.max(400, data.length * 30 + margin.top + margin.bottom);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Create tooltip
    const tooltip = d3.select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute');
    
    // Scales
    const y = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.2);
    
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 1])
        .nice()
        .range([0, innerWidth]);
    
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.category))
        .range(CHART_COLORS);
    
    // Create main group
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Draw bars
    g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('y', d => y(d.category))
        .attr('x', 0)
        .attr('height', y.bandwidth())
        .attr('width', d => Math.max(0, x(d.value)))
        .attr('fill', d => color(d.category))
        .attr('rx', 3)
        .on('mouseover', function(event, d) {
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`<strong>${d.category}</strong><br>${d.value}`)
                .style('left', (event.offsetX + 10) + 'px')
                .style('top', (event.offsetY - 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.transition().duration(500).style('opacity', 0);
        });
    
    // Add value labels on bars
    g.selectAll('.bar-label')
        .data(data)
        .join('text')
        .attr('class', 'bar-label')
        .attr('y', d => y(d.category) + y.bandwidth() / 2)
        .attr('x', d => x(d.value) + 5)
        .attr('dy', '0.35em')
        .text(d => d.value)
        .style('fill', 'rgba(255,255,255,0.9)')
        .style('font-size', '11px');
    
    // Y Axis
    g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y))
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.9)')
        .style('font-size', '11px');
    
    // X Axis
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5))
        .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)'))
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.7)');
    
    // Legend (top items)
    renderLegend(data.slice(0, 6).map(d => ({ label: d.category, color: color(d.category) })));
}

// Vertical Bar Chart
function renderVerticalBarChart(config, chartData) {
    const data = chartData.data;
    const container = document.getElementById('d3Chart');
    const width = getContainerWidth();
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    
    // Get grouping key from config
    const groupKey = config.group_by?.toLowerCase() || 'category';
    
    // Group data by the specified key
    const getGroupValue = (d) => {
        const key = groupKey.replace(/_/g, '');
        return d[groupKey] || d[key] || d.category || d.type || 'Unbekannt';
    };
    
    const grouped = d3.rollup(data, v => v.length, d => getGroupValue(d));
    const chartDataArray = Array.from(grouped, ([key, value]) => ({ category: key, value }))
        .sort((a, b) => b.value - a.value);
    
    // Limit to top 15 categories for readability
    const displayData = chartDataArray.slice(0, 15);
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create tooltip
    const tooltip = d3.select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute');
    
    // Scales
    const x = d3.scaleBand()
        .domain(displayData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(displayData, d => d.value) || 1])
        .nice()
        .range([innerHeight, 0]);
    
    const color = d3.scaleOrdinal()
        .domain(displayData.map(d => d.category))
        .range(CHART_COLORS);
    
    // Create main group
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Draw bars
    g.selectAll('rect')
        .data(displayData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.category))
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => innerHeight - y(d.value))
        .attr('fill', d => color(d.category))
        .attr('rx', 3)
        .on('mouseover', function(event, d) {
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`<strong>${d.category}</strong><br>${d.value}`)
                .style('left', (event.offsetX + 10) + 'px')
                .style('top', (event.offsetY - 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.transition().duration(500).style('opacity', 0);
        });
    
    // X Axis
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.7)')
        .style('font-size', '10px')
        .attr('transform', 'rotate(-45)')
        .attr('text-anchor', 'end');
    
    // Y Axis
    g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y).ticks(5))
        .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)'))
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.7)');
    
    // Legend (top categories)
    renderLegend(displayData.slice(0, 6).map(d => ({ label: d.category, color: color(d.category) })));
}

// Donut Chart
function renderDonutChart(config, chartData) {
    const data = chartData.data;
    const container = document.getElementById('d3Chart');
    const width = getContainerWidth();
    const height = 400;
    const radius = Math.min(width, height) / 2 - 40;
    
    // Group data by origin
    const groupKey = config.group_by.toLowerCase();
    const grouped = d3.rollup(data, v => v.length, d => d[groupKey] || d.origin || 'Unbekannt');
    const pieData = Array.from(grouped, ([key, value]) => ({ name: key, value }));
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);
    
    // Create pie
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
    
    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius);
    
    const color = d3.scaleOrdinal()
        .domain(pieData.map(d => d.name))
        .range(CHART_COLORS);
    
    // Create tooltip
    const tooltip = d3.select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute');
    
    // Draw arcs
    svg.selectAll('path')
        .data(pie(pieData))
        .join('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.name))
        .attr('stroke', '#111')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).transition().duration(200)
                .attr('transform', 'scale(1.05)');
            tooltip.transition().duration(200).style('opacity', 1);
            const percent = Math.round(d.data.value / d3.sum(pieData, p => p.value) * 100);
            tooltip.html(`<strong>${d.data.name}</strong><br>${d.data.value} (${percent}%)`)
                .style('left', (event.offsetX + 10) + 'px')
                .style('top', (event.offsetY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this).transition().duration(200)
                .attr('transform', 'scale(1)');
            tooltip.transition().duration(500).style('opacity', 0);
        });
    
    // Center text
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .style('fill', 'rgba(255,255,255,0.9)')
        .style('font-size', '28px')
        .style('font-weight', '700')
        .text(d3.sum(pieData, d => d.value));
    
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .style('fill', 'rgba(255,255,255,0.5)')
        .style('font-size', '12px')
        .style('text-transform', 'uppercase')
        .style('letter-spacing', '0.1em')
        .text('Gesamt');
    
    // Legend
    renderLegend(pieData.map(d => ({ label: d.name, color: color(d.name) })));
}

// Streamgraph
function renderStreamgraph(config, chartData) {
    const data = chartData.data;
    const container = document.getElementById('d3Chart');
    const width = getContainerWidth();
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    
    // Process data for streamgraph
    const groupKey = config.group_by.toLowerCase().replace(/_/g, '');
    
    // Group by date and burial type - use flexible field lookup
    const getGroupValue = (d) => {
        // Try different possible field names for burial type
        return d.burial_class || d.burial_type || d.burialtype || d.Burial_Type || 'Unbekannt';
    };
    
    const grouped = d3.rollup(
        data,
        v => v.length,
        d => Math.floor((parseInt(d.date_start) || 100) / 50) * 50, // 50-year buckets
        d => getGroupValue(d)
    );
    
    // Get all dates and types
    const dates = Array.from(grouped.keys()).sort((a, b) => a - b);
    const types = new Set();
    grouped.forEach(v => v.forEach((count, type) => types.add(type)));
    const typeArray = Array.from(types);
    
    // Create stacked data
    const stackData = dates.map(date => {
        const row = { date };
        const typeMap = grouped.get(date) || new Map();
        typeArray.forEach(type => {
            row[type] = typeMap.get(type) || 0;
        });
        return row;
    });
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(dates))
        .range([margin.left, width - margin.right]);
    
    const stack = d3.stack()
        .keys(typeArray)
        .offset(d3.stackOffsetWiggle);
    
    const series = stack(stackData);
    
    const y = d3.scaleLinear()
        .domain([
            d3.min(series, s => d3.min(s, d => d[0])),
            d3.max(series, s => d3.max(s, d => d[1]))
        ])
        .range([height - margin.bottom, margin.top]);
    
    const color = d3.scaleOrdinal()
        .domain(typeArray)
        .range(CHART_COLORS);
    
    // Area generator
    const area = d3.area()
        .x(d => x(d.data.date))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);
    
    // Draw areas
    svg.selectAll('path')
        .data(series)
        .join('path')
        .attr('fill', d => color(d.key))
        .attr('d', area)
        .attr('opacity', 0.8);
    
    // X Axis
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d => d + ' n.Chr.'))
        .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.2)'))
        .selectAll('text')
        .style('fill', 'rgba(255,255,255,0.7)');
    
    // Legend
    renderLegend(typeArray.map(t => ({ label: t, color: color(t) })));
}

// Sunburst / Radial Chart for Military Ranks
function renderSunburst(config, chartData) {
    const data = chartData.data;
    const container = document.getElementById('d3Chart');
    const width = getContainerWidth();
    const height = 450;
    const radius = Math.min(width, height) / 2 - 20;
    
    // Group data by rank
    const groupKey = config.group_by.toLowerCase();
    const grouped = d3.rollup(data, v => v.length, d => d[groupKey] || d.rank || 'Unbekannt');
    const pieData = Array.from(grouped, ([key, value]) => ({ name: key, value }))
        .sort((a, b) => b.value - a.value);
    
    const total = d3.sum(pieData, d => d.value);
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);
    
    // Create tooltip
    const tooltip = d3.select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute');
    
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
    
    const arc = d3.arc()
        .innerRadius(radius * 0.35)
        .outerRadius(radius * 0.8);
    
    const hoverArc = d3.arc()
        .innerRadius(radius * 0.35)
        .outerRadius(radius * 0.85);
    
    const color = d3.scaleOrdinal()
        .domain(pieData.map(d => d.name))
        .range(CHART_COLORS);
    
    // Rank descriptions for tooltips
    const rankDescriptions = {
        'Miles': 'Einfacher Legionssoldat',
        'Centurio': 'Befehlshaber einer Centurie (ca. 80 Mann)',
        'Optio': 'Stellvertreter des Centurio',
        'Tribunus Militum': 'Hoher Stabsoffizier der Legion',
        'Legatus Legionis': 'Legionskommandeur (Senator)',
        'Tesserarius': 'Unteroffizier für Wachbefehle',
        'Decurio': 'Befehlshaber einer Reitereinheit',
        'Custos Armorum': 'Waffenwart der Einheit',
        'Armorum Custos': 'Waffenwart der Einheit',
        'Imaginifer': 'Träger des Kaiserbildes',
        'Signifer': 'Feldzeichenträger der Centurie',
        'Tubicen': 'Trompeter / Hornist',
        'Veteran': 'Ausgedienter Soldat (nach 25 Jahren)',
        'Nicht in Quelle': 'Rang nicht überliefert'
    };
    
    // Draw arcs with interaction
    svg.selectAll('path')
        .data(pie(pieData))
        .join('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.name))
        .attr('stroke', '#111')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            // Highlight effect
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', hoverArc);
            
            // Show tooltip
            const percent = Math.round(d.data.value / total * 100);
            const description = rankDescriptions[d.data.name] || '';
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            tooltip.html(`
                <strong style="font-size: 14px;">${d.data.name}</strong><br>
                <span style="color: rgba(255,255,255,0.7); font-size: 12px;">${description}</span>
                <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 6px 0;">
                <span style="font-size: 13px;">${d.data.value} Personen (${percent}%)</span>
            `)
                .style('left', (event.offsetX + 15) + 'px')
                .style('top', (event.offsetY - 15) + 'px');
        })
        .on('mouseout', function() {
            // Reset effect
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', arc);
            
            tooltip.transition()
                .duration(300)
                .style('opacity', 0);
        })
        .on('click', function(event, d) {
            // Show detailed info on click
            const description = rankDescriptions[d.data.name] || 'Keine Beschreibung verfügbar';
            const percent = Math.round(d.data.value / total * 100);
            
            // Keep tooltip visible after click
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            tooltip.html(`
                <strong style="font-size: 14px;">${d.data.name}</strong><br>
                <span style="color: rgba(255,255,255,0.7); font-size: 12px;">${description}</span>
                <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 6px 0;">
                <span style="font-size: 13px;">${d.data.value} Personen (${percent}%)</span>
            `)
                .style('left', (event.offsetX + 15) + 'px')
                .style('top', (event.offsetY - 15) + 'px');
        });
    
    // Labels for larger segments
    const labelArc = d3.arc()
        .innerRadius(radius * 0.58)
        .outerRadius(radius * 0.58);
    
    svg.selectAll('.slice-label')
        .data(pie(pieData).filter(d => d.data.value >= 3))
        .join('text')
        .attr('class', 'slice-label')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .style('fill', 'rgba(255,255,255,0.95)')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('pointer-events', 'none')
        .text(d => d.data.name.length > 12 ? d.data.name.substring(0, 10) + '…' : d.data.name);
    
    // Center text
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .style('fill', 'rgba(255,255,255,0.9)')
        .style('font-size', '28px')
        .style('font-weight', '700')
        .text(total);
    
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .style('fill', 'rgba(255,255,255,0.5)')
        .style('font-size', '11px')
        .style('text-transform', 'uppercase')
        .style('letter-spacing', '0.1em')
        .text('Soldaten');
    
    // Legend with descriptions
    renderLegend(pieData.map(d => ({ 
        label: d.name + ' (' + d.value + ')', 
        color: color(d.name) 
    })));
}

// Map placeholder
// Sankey Diagram with Interactive Node Selection
function renderSankey(config, chartData) {
    const data = chartData.data;
    const container = document.getElementById('d3Chart');
    const width = getContainerWidth();
    const margin = { top: 20, right: 140, bottom: 20, left: 140 };
    
    // Get source and target keys from config
    const sourceKey = config.x_axis_key?.toLowerCase().replace(/\s+/g, '_') || 'origin_provinz';
    const targetKey = config.group_by?.toLowerCase() || 'legion';
    
    // Helper to get field value
    const getFieldValue = (d, key) => {
        const normalizedKey = key.replace(/_/g, '');
        return d[key] || d[normalizedKey] || d[key.toLowerCase()] || 'Unbekannt';
    };
    
    // Build links from data
    const linkCounts = d3.rollup(
        data,
        v => v.length,
        d => getFieldValue(d, sourceKey),
        d => getFieldValue(d, targetKey)
    );
    
    // Create nodes and links arrays
    const nodesSet = new Set();
    const links = [];
    
    linkCounts.forEach((targets, source) => {
        nodesSet.add(source);
        targets.forEach((value, target) => {
            nodesSet.add(target);
            links.push({ source, target, value });
        });
    });
    
    const nodes = Array.from(nodesSet).map(name => ({ name }));
    const nodeIndex = new Map(nodes.map((n, i) => [n.name, i]));
    
    // Separate source and target nodes
    const sourceNodes = [...new Set(links.map(l => l.source))];
    const targetNodes = [...new Set(links.map(l => l.target))];
    
    // Node sizing parameters
    const minNodeHeight = 28;
    const nodePadding = 12;
    const innerWidth = width - margin.left - margin.right;
    
    // Calculate node heights
    const sourceTotal = d3.sum(links, l => l.value);
    
    // Calculate heights for source nodes
    const sourceHeights = sourceNodes.map(name => {
        const nodeLinks = links.filter(l => l.source === name);
        const nodeValue = d3.sum(nodeLinks, l => l.value);
        // Height proportional to value, with minimum
        const proportionalHeight = (nodeValue / sourceTotal) * 400;
        return { name, value: nodeValue, height: Math.max(proportionalHeight, minNodeHeight) };
    });
    
    // Calculate heights for target nodes
    const targetHeights = targetNodes.map(name => {
        const nodeLinks = links.filter(l => l.target === name);
        const nodeValue = d3.sum(nodeLinks, l => l.value);
        const proportionalHeight = (nodeValue / sourceTotal) * 400;
        return { name, value: nodeValue, height: Math.max(proportionalHeight, minNodeHeight) };
    });
    
    // Calculate actual total heights needed
    const sourceTotalHeight = sourceHeights.reduce((sum, n) => sum + n.height + nodePadding, 0) - nodePadding;
    const targetTotalHeight = targetHeights.reduce((sum, n) => sum + n.height + nodePadding, 0) - nodePadding;
    const contentHeight = Math.max(sourceTotalHeight, targetTotalHeight);
    
    // Set final height based on actual content
    const height = contentHeight + margin.top + margin.bottom;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Position source nodes with proper spacing
    const sourcePositions = new Map();
    let yPos = 0;
    sourceHeights.forEach(({ name, value, height }) => {
        sourcePositions.set(name, { y: yPos, height, value });
        yPos += height + nodePadding;
    });
    
    // Position target nodes with proper spacing
    const targetPositions = new Map();
    yPos = 0;
    targetHeights.forEach(({ name, value, height }) => {
        targetPositions.set(name, { y: yPos, height, value });
        yPos += height + nodePadding;
    });
    
    // Colors
    const color = d3.scaleOrdinal()
        .domain(sourceNodes)
        .range(CHART_COLORS);
    
    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Selection state
    let selectedNode = null;
    let selectedType = null; // 'source' or 'target'
    
    // Function to highlight connections
    function highlightNode(nodeName, nodeType) {
        if (selectedNode === nodeName && selectedType === nodeType) {
            // Deselect if clicking same node
            resetHighlight();
            return;
        }
        
        selectedNode = nodeName;
        selectedType = nodeType;
        
        // Dim all links first
        linkGroup.selectAll('path')
            .transition()
            .duration(200)
            .attr('opacity', 0.1);
        
        // Highlight connected links
        linkGroup.selectAll('path')
            .filter(function() {
                const linkSource = d3.select(this).attr('data-source');
                const linkTarget = d3.select(this).attr('data-target');
                if (nodeType === 'source') {
                    return linkSource === nodeName;
                } else {
                    return linkTarget === nodeName;
                }
            })
            .transition()
            .duration(200)
            .attr('opacity', 0.85);
        
        // Dim all nodes
        g.selectAll('.source-node rect, .target-node rect')
            .transition()
            .duration(200)
            .attr('opacity', 0.3);
        
        g.selectAll('.source-node text, .target-node text')
            .transition()
            .duration(200)
            .style('fill', 'rgba(255,255,255,0.4)');
        
        // Highlight selected node and connected nodes
        if (nodeType === 'source') {
            // Highlight source node
            g.selectAll('.source-node')
                .filter(function() { return d3.select(this).attr('data-name') === nodeName; })
                .select('rect')
                .transition()
                .duration(200)
                .attr('opacity', 1);
            
            g.selectAll('.source-node')
                .filter(function() { return d3.select(this).attr('data-name') === nodeName; })
                .select('text')
                .transition()
                .duration(200)
                .style('fill', 'rgba(255,255,255,1)')
                .style('font-weight', '600');
            
            // Find connected targets
            const connectedTargets = links.filter(l => l.source === nodeName).map(l => l.target);
            g.selectAll('.target-node')
                .filter(function() { return connectedTargets.includes(d3.select(this).attr('data-name')); })
                .select('rect')
                .transition()
                .duration(200)
                .attr('opacity', 1);
            
            g.selectAll('.target-node')
                .filter(function() { return connectedTargets.includes(d3.select(this).attr('data-name')); })
                .select('text')
                .transition()
                .duration(200)
                .style('fill', 'rgba(255,255,255,1)');
        } else {
            // Highlight target node
            g.selectAll('.target-node')
                .filter(function() { return d3.select(this).attr('data-name') === nodeName; })
                .select('rect')
                .transition()
                .duration(200)
                .attr('opacity', 1);
            
            g.selectAll('.target-node')
                .filter(function() { return d3.select(this).attr('data-name') === nodeName; })
                .select('text')
                .transition()
                .duration(200)
                .style('fill', 'rgba(255,255,255,1)')
                .style('font-weight', '600');
            
            // Find connected sources
            const connectedSources = links.filter(l => l.target === nodeName).map(l => l.source);
            g.selectAll('.source-node')
                .filter(function() { return connectedSources.includes(d3.select(this).attr('data-name')); })
                .select('rect')
                .transition()
                .duration(200)
                .attr('opacity', 1);
            
            g.selectAll('.source-node')
                .filter(function() { return connectedSources.includes(d3.select(this).attr('data-name')); })
                .select('text')
                .transition()
                .duration(200)
                .style('fill', 'rgba(255,255,255,1)');
        }
    }
    
    function resetHighlight() {
        selectedNode = null;
        selectedType = null;
        
        // Reset all links
        linkGroup.selectAll('path')
            .transition()
            .duration(200)
            .attr('opacity', 0.5);
        
        // Reset all nodes
        g.selectAll('.source-node rect, .target-node rect')
            .transition()
            .duration(200)
            .attr('opacity', 1);
        
        g.selectAll('.source-node text, .target-node text')
            .transition()
            .duration(200)
            .style('fill', 'rgba(255,255,255,0.9)')
            .style('font-weight', 'normal');
    }
    
    // Draw links
    const linkGroup = g.append('g').attr('class', 'links');
    
    // Track y-offsets for stacking
    const sourceOffsets = new Map(sourceNodes.map(n => [n, 0]));
    const targetOffsets = new Map(targetNodes.map(n => [n, 0]));
    
    links.forEach(link => {
        const sourcePos = sourcePositions.get(link.source);
        const targetPos = targetPositions.get(link.target);
        const linkHeight = (link.value / sourcePos.value) * sourcePos.height;
        
        const sourceY = sourcePos.y + sourceOffsets.get(link.source);
        const targetY = targetPos.y + targetOffsets.get(link.target);
        
        sourceOffsets.set(link.source, sourceOffsets.get(link.source) + linkHeight);
        targetOffsets.set(link.target, targetOffsets.get(link.target) + (link.value / targetPos.value) * targetPos.height);
        
        const path = d3.path();
        path.moveTo(20, sourceY);
        path.bezierCurveTo(
            innerWidth / 3, sourceY,
            innerWidth * 2 / 3, targetY,
            innerWidth - 20, targetY
        );
        path.lineTo(innerWidth - 20, targetY + (link.value / targetPos.value) * targetPos.height);
        path.bezierCurveTo(
            innerWidth * 2 / 3, targetY + (link.value / targetPos.value) * targetPos.height,
            innerWidth / 3, sourceY + linkHeight,
            20, sourceY + linkHeight
        );
        path.closePath();
        
        linkGroup.append('path')
            .attr('d', path.toString())
            .attr('fill', color(link.source))
            .attr('opacity', 0.5)
            .attr('data-source', link.source)
            .attr('data-target', link.target)
            .style('cursor', 'pointer')
            .on('mouseover', function() {
                if (!selectedNode) {
                    d3.select(this).attr('opacity', 0.8);
                }
            })
            .on('mouseout', function() {
                if (!selectedNode) {
                    d3.select(this).attr('opacity', 0.5);
                }
            })
            .on('click', function() {
                // Click on link highlights both source and target
                const linkSource = d3.select(this).attr('data-source');
                highlightNode(linkSource, 'source');
            })
            .append('title')
            .text(`${link.source} → ${link.target}: ${link.value}`);
    });
    
    // Draw source nodes (provinces)
    const nodeWidth = 15;
    sourceNodes.forEach(name => {
        const pos = sourcePositions.get(name);
        const nodeGroup = g.append('g')
            .attr('class', 'source-node')
            .attr('data-name', name)
            .style('cursor', 'pointer')
            .on('click', () => highlightNode(name, 'source'));
        
        nodeGroup.append('rect')
            .attr('x', 0)
            .attr('y', pos.y)
            .attr('width', nodeWidth)
            .attr('height', pos.height)
            .attr('fill', color(name))
            .attr('rx', 2);
        
        nodeGroup.append('text')
            .attr('x', -5)
            .attr('y', pos.y + pos.height / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .style('fill', 'rgba(255,255,255,0.9)')
            .style('font-size', '11px')
            .text(name.length > 20 ? name.substring(0, 18) + '...' : name);
        
        // Hover effect
        nodeGroup
            .on('mouseover', function() {
                if (!selectedNode) {
                    d3.select(this).select('rect').attr('opacity', 0.8);
                }
            })
            .on('mouseout', function() {
                if (!selectedNode) {
                    d3.select(this).select('rect').attr('opacity', 1);
                }
            });
    });
    
    // Draw target nodes (legions)
    targetNodes.forEach(name => {
        const pos = targetPositions.get(name);
        const nodeGroup = g.append('g')
            .attr('class', 'target-node')
            .attr('data-name', name)
            .style('cursor', 'pointer')
            .on('click', () => highlightNode(name, 'target'));
        
        nodeGroup.append('rect')
            .attr('x', innerWidth - nodeWidth)
            .attr('y', pos.y)
            .attr('width', nodeWidth)
            .attr('height', pos.height)
            .attr('fill', '#6c757d')
            .attr('rx', 2);
        
        nodeGroup.append('text')
            .attr('x', innerWidth + 5)
            .attr('y', pos.y + pos.height / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'start')
            .style('fill', 'rgba(255,255,255,0.9)')
            .style('font-size', '11px')
            .text(name.length > 25 ? name.substring(0, 23) + '...' : name);
        
        // Hover effect
        nodeGroup
            .on('mouseover', function() {
                if (!selectedNode) {
                    d3.select(this).select('rect').attr('opacity', 0.8);
                }
            })
            .on('mouseout', function() {
                if (!selectedNode) {
                    d3.select(this).select('rect').attr('opacity', 1);
                }
            });
    });
    
    // Click on background to reset
    svg.on('click', function(event) {
        if (event.target === this) {
            resetHighlight();
        }
    });
    
    // Legend
    renderLegend(sourceNodes.slice(0, 6).map(name => ({ label: name, color: color(name) })));
}

function renderMapPlaceholder(config, chartData) {
    const container = document.getElementById('d3Chart');
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.6);">
            ${ICONS.map}
            <h3 style="margin: 20px 0 10px; color: rgba(255,255,255,0.9);">Kartenvisualisierung</h3>
            <p>Diese Visualisierung zeigt die Herkunftsorte auf einer interaktiven Karte.</p>
            <p style="margin-top: 20px; font-size: 13px;">${chartData.data.length} Datenpunkte verfügbar</p>
        </div>
    `;
    container.querySelector('svg').style.cssText = 'width: 60px; height: 60px; opacity: 0.5;';
}

// Render legend
function renderLegend(items) {
    const container = document.getElementById('chartLegend');
    container.innerHTML = items.map(item => `
        <div class="ds-legend-item">
            <span class="ds-legend-color" style="background: ${item.color}"></span>
            <span>${item.label}</span>
        </div>
    `).join('');
}

// Update interpretation
function updateInterpretation(config, chartData) {
    const title = document.getElementById('interpretationTitle');
    const text = document.getElementById('interpretationText');
    
    // Generate interpretation based on chart type
    const interpretations = {
        'chart_01': {
            title: 'Die Rolle des Alters',
            text: 'Das Diagramm verdeutlicht die Altersverteilung der in Carnuntum Bestatteten. Die Daten zeigen typische Muster einer römischen Provinzbevölkerung mit erhöhter Kindersterblichkeit und einer durchschnittlichen Lebenserwartung von etwa 35-40 Jahren.'
        },
        'chart_02': {
            title: 'Wandel der Bestattungssitten',
            text: 'Die Visualisierung zeigt den kulturellen Wandel von Brand- zu Körperbestattung. Während in der frühen Kaiserzeit die Kremation vorherrschte, setzte sich ab dem 2. Jahrhundert n. Chr. zunehmend die Körperbestattung durch.'
        },
        'chart_03': {
            title: 'Herkunft der Legionäre',
            text: 'Die Karte zeigt die weitreichenden Rekrutierungsgebiete des römischen Militärs. Soldaten aus dem gesamten Imperium fanden in Carnuntum ihre letzte Ruhestätte.'
        },
        'chart_04': {
            title: 'Handelsnetzwerke',
            text: 'Die Analyse der Grabbeigaben offenbart weitreichende Handelsbeziehungen. Importierte Waren aus dem gesamten Mittelmeerraum bezeugen die wirtschaftliche Bedeutung Carnuntums.'
        },
        'chart_05': {
            title: 'Militärische Hierarchie',
            text: 'Die Verteilung der militärischen Ränge zeigt die soziale Struktur der Legion. Einfache Soldaten bilden die Basis, während höhere Offiziere selten, aber prominent vertreten sind.'
        }
    };
    
    const interp = interpretations[config.chart_id] || {
        title: 'Analyse der Daten',
        text: config.description_de || config.description
    };
    
    title.textContent = interp.title;
    text.textContent = interp.text;
}

// Show error
function showError(message) {
    const container = document.getElementById('chartContainer');
    container.innerHTML = `<p style="color: #ff6b6b; text-align: center;">${message}</p>`;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
