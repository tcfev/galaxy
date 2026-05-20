/* ============================================================
   TCF Galaxy — D3 Force Graph
   ============================================================ */
'use strict';

(function () {
  /* ── Dimensions ─────────────────────────────────────────── */
  let W = window.innerWidth;
  let H = window.innerHeight;

  let currentScale = 0.75;
  let selectedNodeId = null;

  /* ── SVG Root ───────────────────────────────────────────── */
  const svg = d3
    .select('#graph')
    .attr('width', W)
    .attr('height', H);

  const defs = svg.append('defs');

  /* ── Glow Filters ───────────────────────────────────────── */
  function makeGlow(id, blur) {
    const f = defs
      .append('filter')
      .attr('id', id)
      .attr('x', '-150%').attr('y', '-150%')
      .attr('width', '400%').attr('height', '400%');
    f.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', blur)
      .attr('result', 'blur');
    const m = f.append('feMerge');
    m.append('feMergeNode').attr('in', 'blur');
    m.append('feMergeNode').attr('in', 'SourceGraphic');
  }

  makeGlow('glow-soft',   3.5);
  makeGlow('glow-medium', 7);
  makeGlow('glow-strong', 14);

  /* ── Radial Gradients per Node ──────────────────────────── */
  TCF_DATA.nodes.forEach(n => {
    const g = defs.append('radialGradient').attr('id', `grad-${n.id}`);
    g.append('stop').attr('offset', '0%').attr('stop-color', n.color).attr('stop-opacity', 1);
    g.append('stop').attr('offset', '50%').attr('stop-color', n.color).attr('stop-opacity', 0.65);
    g.append('stop').attr('offset', '100%').attr('stop-color', n.color).attr('stop-opacity', 0.04);
  });

  /* ── Graph Group (transformed by zoom) ─────────────────── */
  const root = svg.append('g').attr('id', 'graph-root');
  const gLinks = root.append('g').attr('class', 'links-layer');
  const gNodes = root.append('g').attr('class', 'nodes-layer');

  /* ── Zoom ───────────────────────────────────────────────── */
  const zoom = d3.zoom()
    .scaleExtent([0.12, 5])
    .on('zoom', onZoom);

  svg.call(zoom);

  const initialTransform = d3.zoomIdentity.translate(W / 2, H / 2).scale(0.75);

  function onZoom(event) {
    currentScale = event.transform.k;
    root.attr('transform', event.transform);
    updateZoomClass(currentScale);
  }

  function updateZoomClass(k) {
    svg.classed('zoom-far',    k < 0.42);
    svg.classed('zoom-medium', k >= 0.42 && k < 0.9);
    svg.classed('zoom-close',  k >= 0.9);
  }

  /* ── Data: clone so D3 can mutate ──────────────────────── */
  const nodes = TCF_DATA.nodes.map(d => ({ ...d }));
  const links = TCF_DATA.links.map(d => ({ ...d }));

  /* ── Force Simulation ───────────────────────────────────── */
  const simulation = d3.forceSimulation(nodes)
    .force('link',
      d3.forceLink(links)
        .id(d => d.id)
        .distance(d => 220 - (d.strength || 0.5) * 100)
        .strength(d => (d.strength || 0.5) * 0.35)
    )
    .force('charge',
      d3.forceManyBody().strength(d => -420 - d.size * 9)
    )
    .force('center', d3.forceCenter(0, 0).strength(0.04))
    .force('collide',
      d3.forceCollide().radius(d => d.size + 38).strength(0.85)
    )
    .alphaDecay(0.018)
    .velocityDecay(0.45);

  // Pre-warm: run ticks synchronously so initial render looks settled
  simulation.stop();
  for (let i = 0; i < 250; i++) simulation.tick();

  /* ── Link Elements ──────────────────────────────────────── */
  const linkEls = gLinks.selectAll('.link')
    .data(links)
    .join('line')
    .attr('class', 'link')
    .attr('stroke', d => {
      const src = nodes.find(n => n.id === (typeof d.source === 'object' ? d.source.id : d.source));
      return src ? src.color : 'rgba(255,255,255,0.2)';
    })
    .attr('stroke-width', d => Math.max(0.5, (d.strength || 0.5) * 1.8))
    .attr('stroke-opacity', 0.22);

  /* ── Node Groups ────────────────────────────────────────── */
  const nodeGroups = gNodes.selectAll('.node-group')
    .data(nodes)
    .join('g')
    .attr('class', d => `node-group cat-${d.category}`)
    .attr('data-id', d => d.id)
    .call(
      d3.drag()
        .on('start', dragStart)
        .on('drag',  dragging)
        .on('end',   dragEnd)
    )
    .on('click', onNodeClick)
    .on('mouseenter', onNodeEnter)
    .on('mouseleave', onNodeLeave);

  // Outer halo (CSS pulse animation)
  nodeGroups.append('circle')
    .attr('class', 'node-halo')
    .attr('r', d => d.size)
    .attr('fill', 'none')
    .attr('stroke', d => d.color)
    .attr('stroke-opacity', 0.18)
    .attr('stroke-width', 1.5)
    .style('animation-delay', () => `${(Math.random() * 3).toFixed(2)}s`);

  // Main filled circle
  nodeGroups.append('circle')
    .attr('class', 'node-circle')
    .attr('r', d => d.size)
    .attr('fill', d => `url(#grad-${d.id})`)
    .attr('filter', 'url(#glow-soft)');

  // Inner rim highlight
  nodeGroups.append('circle')
    .attr('class', 'node-rim')
    .attr('r', d => d.size)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.14)')
    .attr('stroke-width', 1);

  // Label: short name
  nodeGroups.append('text')
    .attr('class', 'node-name')
    .attr('dy', d => d.size + 16)
    .attr('text-anchor', 'middle')
    .text(d => d.label);

  // Label: tagline (visible only when zoomed close)
  nodeGroups.append('text')
    .attr('class', 'node-tagline')
    .attr('dy', d => d.size + 30)
    .attr('text-anchor', 'middle')
    .text(d => d.tagline);

  // Apply initial positions from pre-warmed simulation
  nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
  linkEls
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

  /* ── Simulation Tick ────────────────────────────────────── */
  simulation.on('tick', () => {
    linkEls
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Restart with low alpha for gentle settling
  simulation.alpha(0.18).restart();

  // Apply initial zoom after a short delay
  requestAnimationFrame(() => {
    svg.call(zoom.transform, initialTransform);
    updateZoomClass(0.75);
  });

  /* ── Drag Handlers ──────────────────────────────────────── */
  function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.25).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragging(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  /* ── Hover ──────────────────────────────────────────────── */
  function getConnectedIds(nodeId) {
    const ids = new Set();
    links.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s === nodeId) ids.add(t);
      if (t === nodeId) ids.add(s);
    });
    return ids;
  }

  function onNodeEnter(event, d) {
    const connected = getConnectedIds(d.id);

    d3.select(this).select('.node-circle').attr('filter', 'url(#glow-medium)');

    linkEls.attr('stroke-opacity', link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      return s === d.id || t === d.id ? 0.7 : 0.06;
    });

    nodeGroups.style('opacity', n =>
      n.id === d.id || connected.has(n.id) ? 1 : 0.2
    );
  }

  function onNodeLeave(event, d) {
    if (selectedNodeId === d.id) return;
    d3.select(this).select('.node-circle').attr('filter', 'url(#glow-soft)');
    resetHighlight();
  }

  function resetHighlight() {
    linkEls.attr('stroke-opacity', 0.22);
    nodeGroups.style('opacity', 1);
  }

  /* ── Node Click → zoom + panel ──────────────────────────── */
  function onNodeClick(event, d) {
    event.stopPropagation();
    selectedNodeId = d.id;

    // Zoom camera to the node
    const targetScale = Math.max(currentScale, 1.4);
    const tx = d3.zoomIdentity
      .translate(W / 2, H / 2)
      .scale(targetScale)
      .translate(-d.x, -d.y);

    svg.transition()
      .duration(680)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, tx);

    // Highlight selected node
    nodeGroups.select('.node-circle')
      .attr('filter', n => n.id === d.id ? 'url(#glow-strong)' : 'url(#glow-soft)');

    showPanel(d);
  }

  // Click on SVG backdrop → close panel
  svg.on('click', () => {
    if (selectedNodeId) closePanel();
  });

  /* ── Detail Panel ───────────────────────────────────────── */
  function showPanel(node) {
    const connected = getConnectedIds(node.id);
    const relatedNodes = nodes.filter(n => connected.has(n.id));

    document.getElementById('panel-title').textContent = node.label;
    document.getElementById('panel-fullname').textContent = node.fullName;
    document.getElementById('panel-tagline').textContent = node.tagline;
    document.getElementById('panel-description').textContent = node.description;

    const badge = document.getElementById('panel-badge');
    badge.textContent = node.status;
    badge.style.borderColor = node.color;
    badge.style.color = node.color;
    badge.style.boxShadow = `0 0 12px ${node.color}30`;

    // Color accent bar
    document.getElementById('panel-accent').style.background = node.color;

    // Links
    const linksEl = document.getElementById('panel-links');
    linksEl.innerHTML = (node.links || [])
      .map(l =>
        `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="panel-link"
            style="border-color:${node.color}33; color:${node.color};">
          ${l.label}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </a>`
      )
      .join('');

    // Related nodes
    const relList = document.getElementById('panel-related-list');
    relList.innerHTML = relatedNodes
      .map(n =>
        `<button class="related-chip" data-id="${n.id}"
            style="border-color:${n.color}3a; color:${n.color}bb;">
          <span class="chip-dot" style="background:${n.color};"></span>
          ${n.label}
        </button>`
      )
      .join('');

    relList.querySelectorAll('.related-chip').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const target = nodes.find(n => n.id === btn.dataset.id);
        if (target) {
          onNodeClick({ stopPropagation: () => {} }, target);
        }
      });
    });

    const panel = document.getElementById('panel');
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('panel--open');
    // Dismiss hint after first panel open
    document.getElementById('hint').style.opacity = '0';
  }

  function closePanel() {
    selectedNodeId = null;
    const panel = document.getElementById('panel');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('panel--open');
    nodeGroups.select('.node-circle').attr('filter', 'url(#glow-soft)');
    resetHighlight();
  }

  document.getElementById('panel-close').addEventListener('click', e => {
    e.stopPropagation();
    closePanel();
  });

  /* ── Category Filters ───────────────────────────────────── */
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const cat = pill.dataset.category;

      nodeGroups.transition().duration(300).style('opacity', d =>
        cat === 'all' || d.category === cat ? 1 : 0.1
      );
      linkEls.transition().duration(300).attr('stroke-opacity', link => {
        if (cat === 'all') return 0.22;
        const s = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
        const t = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
        return s?.category === cat || t?.category === cat ? 0.45 : 0.04;
      });
    });
  });

  /* ── Reset Button ───────────────────────────────────────── */
  document.getElementById('btn-reset').addEventListener('click', e => {
    e.stopPropagation();
    closePanel();
    svg.transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoom.transform, initialTransform);
  });

  /* ── ESC Key ────────────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && selectedNodeId) closePanel();
  });

  /* ── Resize ─────────────────────────────────────────────── */
  window.addEventListener('resize', () => {
    W = window.innerWidth;
    H = window.innerHeight;
    svg.attr('width', W).attr('height', H);
    simulation.force('center', d3.forceCenter(0, 0));
  });
})();
