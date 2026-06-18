import plotly.graph_objects as go

# 1. Labels updated to exactly match the sum of the transition flows!
labels = [
    "<b>Dense Vegetation</b> (2015)<br>2,148.8 km²",      # Sum of flows 11, 12, 13, 14
    "<b>Sparse/Degraded Veg</b> (2015)<br>989.6 km²",     # Sum of flows 21, 22, 23, 24
    "<b>Built-up / Bare Soil</b> (2015)<br>244.9 km²",    # Sum of flows 31, 32, 33, 34
    "<b>Water</b> (2015)<br>96.2 km²",                    # Sum of flows 41, 42, 43, 44
    
    "<b>Dense Vegetation</b> (2024)<br>2,199.6 km² <i>(+50.8)</i>",      # Sum of flows 11, 21, 31, 41
    "<b>Sparse/Degraded Veg</b> (2024)<br>928.4 km² <i>(-61.2)</i>",     # Sum of flows 12, 22, 32, 42
    "<b>Built-up / Bare Soil</b> (2024)<br>262.8 km² <i>(+17.9)</i>",    # Sum of flows 13, 23, 33, 43
    "<b>Water</b> (2024)<br>88.7 km² <i>(-7.5)</i>"                      # Sum of flows 14, 24, 34, 44
]

# 2. Node colors matching your map
node_colors = [
    "#1A6B1A", "#A6D96A", "#C0C0B8", "#185FA5", 
    "#1A6B1A", "#A6D96A", "#C0C0B8", "#185FA5"  
]

# 3. Transition Matrix Values (Your exact console numbers)
sources = [0,0,0,0,  1,1,1,1,  2,2,2,2,  3,3,3,3]
targets = [4,5,6,7,  4,5,6,7,  4,5,6,7,  4,5,6,7]
values  = [
    2071.75, 69.64, 6.80, 0.58,   # Source: Dense Veg 2015
    117.82, 770.16, 70.32, 31.30, # Source: Sparse Veg 2015
    3.21, 59.09, 174.94, 7.69,    # Source: Built-up 2015
    6.77, 29.53, 10.76, 49.15     # Source: Water 2015
]

# 4. Source-Based Link Colors
color_dense = "rgba(26, 107, 26, 0.45)"      
color_sparse = "rgba(166, 217, 106, 0.45)"   
color_built = "rgba(192, 192, 184, 0.55)"    
color_water = "rgba(24, 95, 165, 0.45)"      

link_colors = (
    [color_dense] * 4 + 
    [color_sparse] * 4 + 
    [color_built] * 4 + 
    [color_water] * 4
)

# 5. Build the Sankey diagram layout
fig = go.Figure(data=[go.Sankey(
    valueformat = ",.1f",
    valuesuffix = " km²",
    node = dict(
      pad = 35,          
      thickness = 25,    
      line = dict(color = "black", width = 0.5),
      label = labels,
      color = node_colors
    ),
    link = dict(
      source = sources,
      target = targets,
      value = values,
      color = link_colors
  ))])

# 6. Poster Formatting
fig.update_layout(
    title_text="<b>LULC Transitions in Bagmati Watershed (2015 - 2024)</b>",
    font=dict(size=13, family="Arial, sans-serif"),
    plot_bgcolor='white',
    paper_bgcolor='white',
    width=1100,  
    height=700
)

fig.show()
