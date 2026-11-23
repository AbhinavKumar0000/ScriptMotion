export interface CurriculumTopic {
  id: string;
  subject: "science" | "mathematics" | "physics" | "chemistry" | "biology";
  class: 8 | 9 | 10 | 11 | 12;
  chapter: string;
  topic: string;
  subtopics: string[];
  keywords: string[];
  learningObjectives: string[];
  prerequisites: string[];
  difficulty: "introductory" | "intermediate" | "advanced";
  estimatedHours: number;
}

export interface CurriculumChapter {
  id: string;
  subject: "science" | "mathematics" | "physics" | "chemistry" | "biology";
  class: 8 | 9 | 10 | 11 | 12;
  number: number;
  title: string;
  topics: CurriculumTopic[];
}

export interface CurriculumData {
  subjects: {
    science: CurriculumChapter[];
    mathematics: CurriculumChapter[];
    physics: CurriculumChapter[];
    chemistry: CurriculumChapter[];
    biology: CurriculumChapter[];
  };
  lastUpdated: string;
  source: string;
}

const NCERT_BASE_URLS = {
  science: "https://ncert.nic.in/textbook/pdf/",
  mathematics: "https://ncert.nic.in/textbook/pdf/",
  physics: "https://ncert.nic.in/textbook/pdf/",
  chemistry: "https://ncert.nic.in/textbook/pdf/",
  biology: "https://ncert.nic.in/textbook/pdf/",
};

const SCIENCE_CHAPTERS: Record<number, { title: string; topics: Array<{ topic: string; subtopics: string[] }> }> = {
  8: {
    1: { title: "Crop Production and Management", topics: [{ topic: "Agricultural Practices", subtopics: ["Preparation of Soil", "Sowing", "Adding Manure and Fertilisers", "Irrigation", "Protection from Weeds", "Harvesting", "Storage"] }] },
    2: { title: "Microorganisms: Friend and Foe", topics: [{ topic: "Microorganisms", subtopics: ["Where do Microorganisms Live?", "Microorganisms and Us", "Harmful Microorganisms", "Food Preservation", "Nitrogen Fixation", "Nitrogen Cycle"] }] },
    3: { title: "Synthetic Fibres and Plastics", topics: [{ topic: "Synthetic Fibres", subtopics: ["What are Synthetic Fibres?", "Types of Synthetic Fibres", "Characteristics of Synthetic Fibres", "Plastics", "Plastics as Materials of Choice", "Plastics and the Environment"] }] },
    4: { title: "Materials: Metals and Non-Metals", topics: [{ topic: "Physical Properties", subtopics: ["Metals", "Non-Metals"] }, { topic: "Chemical Properties", subtopics: ["Reaction with Oxygen", "Reaction with Water", "Reaction with Acids", "Reaction with Bases", "Displacement Reactions"] }, { topic: "Uses", subtopics: ["Metals", "Non-Metals"] }] },
    5: { title: "Coal and Petroleum", topics: [{ topic: "Coal", subtopics: ["Formation", "Types", "Uses"] }, { topic: "Petroleum", subtopics: ["Formation", "Refining", "Uses"] }, { topic: "Natural Gas", subtopics: [] }] },
    6: { title: "Combustion and Flame", topics: [{ topic: "Combustion", subtopics: ["What is Combustion?", "How Do We Control Fire?", "Types of Combustion"] }, { topic: "Flame", subtopics: ["Structure of a Flame", "What is a Fuel?", "Fuel Efficiency"] }] },
    7: { title: "Conservation of Plants and Animals", topics: [{ topic: "Deforestation", subtopics: ["Causes", "Consequences", "Conservation of Forest and Wildlife"] }, { topic: "Biosphere Reserve", subtopics: ["Flora and Fauna", "Endemic Species", "Wildlife Sanctuary", "National Park", "Red Data Book", "Migration", "Recycling of Paper", "Reforestation"] }] },
    8: { title: "Cell - Structure and Functions", topics: [{ topic: "Discovery of the Cell", subtopics: [] }, { topic: "The Cell", subtopics: ["Organisms show Variety in Cell Number, Shape and Size"] }, { topic: "Cell Structure and Function", subtopics: ["Cell Membrane", "Cell Wall", "Nucleus", "Cytoplasm", "Cell Organelles"] }, { topic: "Comparison of Plant and Animal Cells", subtopics: [] }] },
    9: { title: "Reproduction in Animals", topics: [{ topic: "Modes of Reproduction", subtopics: ["Sexual Reproduction", "Asexual Reproduction"] }, { topic: "Sexual Reproduction", subtopics: ["Male Reproductive Organs", "Female Reproductive Organs", "Fertilisation", "Development of Embryo", "Viviparous and Oviparous Animals"] }, { topic: "Asexual Reproduction", subtopics: [] }] },
    10: { title: "Reaching the Age of Adolescence", topics: [{ topic: "Adolescence and Puberty", subtopics: ["Changes at Puberty", "Secondary Sexual Characters", "Role of Hormones", "Reproductive Phase of Life in Humans", "How is the Sex of the Baby Determined?", "Hormones other than Sex Hormones", "Role of Hormones in Completing the Life History of Insects and Frogs", "Reproductive Health"] }] },
    11: { title: "Force and Pressure", topics: [{ topic: "Force", subtopics: ["A Push or a Pull", "Forces are due to an Interaction", "Exploring Forces", "A Force can Change the State of Motion", "Force can Change the Shape of an Object", "Contact Forces", "Non-contact Forces"] }, { topic: "Pressure", subtopics: ["Pressure Exerted by Liquids and Gases", "Atmospheric Pressure"] }] },
    12: { title: "Friction", topics: [{ topic: "Force of Friction", subtopics: [] }, { topic: "Factors affecting Friction", subtopics: [] }, { topic: "Friction: A Necessary Evil", subtopics: [] }, { topic: "Increasing and Reducing Friction", subtopics: [] }, { topic: "Wheels Reduce Friction", subtopics: [] }, { topic: "Fluid Friction", subtopics: [] }] },
    13: { title: "Sound", topics: [{ topic: "Sound is Produced by Vibrating Bodies", subtopics: [] }, { topic: "Sound Produced by Humans", subtopics: [] }, { topic: "Sound Needs a Medium for Propagation", subtopics: [] }, { topic: "We Hear Sound through Our Ears", subtopics: [] }, { topic: "Amplitude, Time Period and Frequency", subtopics: [] }, { topic: "Audible and Inaudible Sounds", subtopics: [] }, { topic: "Noise and Music", subtopics: [] }, { topic: "Noise Pollution", subtopics: [] }] },
    14: { title: "Chemical Effects of Electric Current", topics: [{ topic: "Do Liquids Conduct Electricity?", subtopics: [] }, { topic: "Chemical Effects of Electric Current", subtopics: [] }, { topic: "Electroplating", subtopics: [] }] },
    15: { title: "Some Natural Phenomena", topics: [{ topic: "Lightning", subtopics: [] }, { topic: "Charging by Rubbing", subtopics: [] }, { topic: "Types of Charges and their Interaction", subtopics: [] }, { topic: "Transfer of Charge", subtopics: [] }, { topic: "The Story of Lightning", subtopics: [] }, { topic: "Earthquakes", subtopics: [] }] },
    16: { title: "Light", topics: [{ topic: "What makes Things Visible", subtopics: [] }, { topic: "Laws of Reflection", subtopics: [] }, { topic: "Regular and Diffused Reflection", subtopics: [] }, { topic: "Reflected Light can be Reflected Again", subtopics: [] }, { topic: "Multiple Images", subtopics: [] }, { topic: "Sunlight - White or Coloured?", subtopics: [] }, { topic: "What is inside Our Eyes?", subtopics: [] }, { topic: "Care of the Eyes", subtopics: [] }, { topic: "Visually Impaired Persons Can Read and Write", subtopics: [] }, { topic: "What is the Braille System?", subtopics: [] }] },
    17: { title: "Stars and the Solar System", topics: [{ topic: "The Moon", subtopics: [] }, { topic: "The Stars", subtopics: [] }, { topic: "Constellations", subtopics: [] }, { title: "The Solar System", subtopics: ["The Sun", "The Planets", "Some Other Members of the Solar System"] }] },
    18: { title: "Pollution of Air and Water", topics: [{ topic: "Air Pollution", subtopics: ["How does Air Get Polluted?", "Case Study: The Taj Mahal", "Greenhouse Effect", "What can be Done?"] }, { topic: "Water Pollution", subtopics: ["How does Water Get Polluted?", "What is Potable Water?", "What can be Done?"] }] },
  },
  9: {
    1: { title: "Matter in Our Surroundings", topics: [{ topic: "Physical Nature of Matter", subtopics: [] }, { topic: "Characteristics of Particles of Matter", subtopics: [] }, { topic: "States of Matter", subtopics: ["Solid", "Liquid", "Gas"] }, { topic: "Can Matter Change its State?", subtopics: ["Effect of Change of Temperature", "Effect of Change of Pressure", "Evaporation"] }] },
    2: { title: "Is Matter Around Us Pure?", topics: [{ topic: "What is a Mixture?", subtopics: ["Types of Mixtures", "Solution", "Suspension", "Colloidal Solution"] }, { topic: "Separating the Components of a Mixture", subtopics: ["Separation of Cream from Milk", "Separation of Two Immiscible Liquids", "Separation of Salt from its Solution", "Separation of Components of Air", "Separation of Acetone and Water"] }, { topic: "Physical and Chemical Changes", subtopics: [] }, { topic: "Types of Pure Substances", subtopics: ["Elements", "Compounds"] }] },
    8: { title: "Motion", topics: [{ topic: "Describing Motion", subtopics: ["Motion Along a Straight Line", "Uniform Motion and Non-uniform Motion", "Measuring the Rate of Motion", "Speed with Direction", "Rate of Change of Velocity"] }, { topic: "Graphical Representation of Motion", subtopics: ["Distance-Time Graphs", "Velocity-Time Graphs"] }, { topic: "Equations of Motion by Graphical Method", subtopics: ["Equation for Velocity-Time Relation", "Equation for Position-Time Relation", "Equation for Position-Velocity Relation"] }, { topic: "Uniform Circular Motion", subtopics: [] }] },
    9: { title: "Force and Laws of Motion", topics: [{ topic: "Balanced and Unbalanced Forces", subtopics: [] }, { topic: "First Law of Motion", subtopics: [] }, { topic: "Inertia and Mass", subtopics: [] }, { topic: "Second Law of Motion", subtopics: [] }, { topic: "Third Law of Motion", subtopics: [] }, { topic: "Conservation of Momentum", subtopics: [] }] },
    10: { title: "Gravitation", topics: [{ topic: "Gravitation", subtopics: ["Universal Law of Gravitation", "Importance of the Universal Law of Gravitation"] }, { topic: "Free Fall", subtopics: ["To Calculate the Value of g", "Motion of Objects Under the Influence of Gravitational Force of the Earth"] }, { topic: "Mass and Weight", subtopics: [] }, { topic: "Thrust and Pressure", subtopics: ["Pressure in Fluids", "Buoyancy", "Why Objects Float or Sink When Placed on the Surface of Water?", "Archimedes' Principle", "Relative Density"] }] },
    11: { title: "Work and Energy", topics: [{ topic: "Work", subtopics: ["Not Much 'Work' in Spite of Working Hard!", "Scientific Conception of Work", "Work Done by a Constant Force"] }, { topic: "Energy", subtopics: ["Forms of Energy", "Kinetic Energy", "Potential Energy", "Rate of Doing Work", "Commercial Unit of Energy"] }] },
    12: { title: "Sound", topics: [{ topic: "Production of Sound", subtopics: [] }, { topic: "Propagation of Sound", subtopics: ["Sound Needs a Medium to Travel", "Sound Waves are Longitudinal Waves", "Characteristics of a Sound Wave", "Speed of Sound in Different Media"] }, { topic: "Reflection of Sound", subtopics: ["Echo", "Reverberation", "Uses of Multiple Reflection of Sound"] }, { topic: "Range of Hearing", subtopics: [] }, { topic: "Applications of Ultrasound", subtopics: [] }, { topic: "Structure of Human Ear", subtopics: [] }] },
  },
  10: {
    1: { title: "Chemical Reactions and Equations", topics: [{ topic: "Chemical Equations", subtopics: ["Writing a Chemical Equation", "Balanced Chemical Equations"] }, { topic: "Types of Chemical Reactions", subtopics: ["Combination Reaction", "Decomposition Reaction", "Displacement Reaction", "Double Displacement Reaction"] }, { topic: "Oxidation and Reduction", subtopics: [] }] },
    2: { title: "Acids, Bases and Salts", topics: [{ topic: "Understanding the Chemical Properties of Acids and Bases", subtopics: ["Acids and Bases in the Laboratory", "How do Acids and Bases React with Metals?", "How do Metal Carbonates and Metal Hydrogen Carbonates React with Acids?", "How do Acids and Bases React with each other?", "Reaction of Metallic Oxides with Acids", "Reaction of Non-Metallic Oxides with Bases"] }, { topic: "What do All Acids and All Bases have in Common?", subtopics: ["What Happens to an Acid or a Base in a Water Solution?"] }, { topic: "How Strong are Acid or Base Solutions?", subtopics: ["Importance of pH in Everyday Life"] }, { topic: "More about Salts", subtopics: ["Family of Salts", "pH of Salts", "Chemicals from Common Salt", "Are the Crystals of Salts really Dry?"] }] },
    10: { title: "Light - Reflection and Refraction", topics: [{ topic: "Reflection of Light", subtopics: [] }, { topic: "Spherical Mirrors", subtopics: ["Image Formation by Spherical Mirrors", "Representation of Images Formed by Spherical Mirrors Using Ray Diagrams", "Mirror Formula and Magnification"] }, { topic: "Refraction of Light", subtopics: ["Refraction through a Rectangular Glass Slab", "The Refractive Index", "Refraction by Spherical Lenses", "Image Formation by Lenses", "Image Formation in Lenses Using Ray Diagrams", "Lens Formula and Magnification", "Power of a Lens"] }] },
    11: { title: "Human Eye and Colourful World", topics: [{ topic: "The Human Eye", subtopics: ["Power of Accommodation", "Defects of Vision and their Correction"] }, { topic: "Refraction of Light through a Prism", subtopics: [] }, { topic: "Dispersion of White Light by a Glass Prism", subtopics: [] }, { topic: "Atmospheric Refraction", subtopics: [] }, { topic: "Scattering of Light", subtopics: ["Tyndall Effect", "Why is the Colour of the Sky Blue?", "Colour of the Sun at Sunrise and Sunset"] }] },
    12: { title: "Electricity", topics: [{ topic: "Electric Current and Circuit", subtopics: ["Electric Current", "Electric Potential and Potential Difference", "Circuit Diagram", "Ohm's Law", "Factors on which the Resistance of a Conductor Depends", "Resistance of a System of Resistors", "Heating Effect of Electric Current", "Electric Power"] }] },
    13: { title: "Magnetic Effects of Electric Current", topics: [{ topic: "Magnetic Field and Field Lines", subtopics: [] }, { topic: "Magnetic Field due to a Current-Carrying Conductor", subtopics: ["Magnetic Field due to a Current through a Straight Conductor", "Right-Hand Thumb Rule", "Magnetic Field due to a Current through a Circular Loop", "Magnetic Field due to a Current in a Solenoid"] }, { topic: "Force on a Current-Carrying Conductor in a Magnetic Field", subtopics: [] }, { topic: "Electric Motor", subtopics: [] }, { topic: "Electromagnetic Induction", subtopics: [] }, { topic: "Electric Generator", subtopics: [] }, { topic: "Domestic Electric Circuits", subtopics: [] }] },
  },
};

const MATH_CHAPTERS: Record<number, { title: string; topics: Array<{ topic: string; subtopics: string[] }> }> = {
  8: {
    1: { title: "Rational Numbers", topics: [{ topic: "Properties of Rational Numbers", subtopics: ["Closure", "Commutativity", "Associativity", "Distributivity", "Reciprocal", "Negative"] }, { topic: "Representation on Number Line", subtopics: [] }, { topic: "Rational Numbers between Two Rational Numbers", subtopics: [] }] },
    2: { title: "Linear Equations in One Variable", topics: [{ topic: "Solving Equations", subtopics: ["Linear Expressions on one Side and Numbers on the other Side", "Variables on both Sides", "Reducing Equations to Simpler Form", "Equations Reducible to Linear Form"] }, { topic: "Applications", subtopics: [] }] },
    3: { title: "Understanding Quadrilaterals", topics: [{ topic: "Polygons", subtopics: ["Classification", "Diagonals", "Convex and Concave", "Regular and Irregular", "Angle Sum Property"] }, { topic: "Sum of Exterior Angles", subtopics: [] }, { topic: "Kinds of Quadrilaterals", subtopics: ["Trapezium", "Kite", "Parallelogram", "Elements of Parallelogram", "Rhombus", "Rectangle", "Square"] }] },
    4: { title: "Practical Geometry", topics: [{ topic: "Constructing Quadrilaterals", subtopics: ["When Four Sides and One Diagonal are Given", "When Two Diagonals and Three Sides are Given", "When Two Adjacent Sides and Three Angles are Given", "When Three Sides and Two Included Angles are Given", "When Other Special Properties are Known"] }] },
    5: { title: "Data Handling", topics: [{ topic: "Looking for Information", subtopics: [] }, { topic: "Organising Data", subtopics: ["Grouping Data", "Bars with a Difference"] }, { topic: "Circle Graph or Pie Chart", subtopics: ["Drawing Pie Charts"] }, { topic: "Chance and Probability", subtopics: ["Getting a Result", "Equally Likely Outcomes", "Linking Chances to Probability", "Outcomes as Events", "Chances and Probability Related to Real Life"] }] },
    6: { title: "Squares and Square Roots", topics: [{ topic: "Properties of Square Numbers", subtopics: [] }, { topic: "Finding Square of a Number", subtopics: ["Other Patterns in Squares", "Pythagorean Triplets"] }, { topic: "Square Roots", subtopics: ["Finding Square Roots", "Square Roots of Decimals", "Estimating Square Roots"] }] },
    7: { title: "Cubes and Cube Roots", topics: [{ topic: "Cubes", subtopics: ["Some Interesting Patterns"] }, { topic: "Cube Roots", subtopics: ["Cube Root through Prime Factorisation", "Cube Root of a Cube Number"] }] },
    8: { title: "Comparing Quantities", topics: [{ topic: "Ratios and Percentages", subtopics: [] }, { topic: "Finding Increase or Decrease Percent", subtopics: [] }, { topic: "Finding Discounts", subtopics: [] }, { topic: "Prices Related to Buying and Selling", subtopics: ["Profit and Loss"] }, { topic: "Sales Tax/Value Added Tax/Goods and Services Tax", subtopics: [] }, { topic: "Compound Interest", subtopics: ["Deducing a Formula", "Rate Compounded Annually or Half Yearly", "Applications"] }] },
    9: { title: "Algebraic Expressions and Identities", topics: [{ topic: "What are Expressions?", subtopics: ["Terms, Factors and Coefficients", "Monomials, Binomials and Polynomials", "Like and Unlike Terms", "Addition and Subtraction", "Multiplication"] }, { topic: "Standard Identities", subtopics: ["Applying Identities"] }] },
    10: { title: "Visualising Solid Shapes", topics: [{ topic: "Views of 3D Shapes", subtopics: [] }, { topic: "Mapping Space Around Us", subtopics: [] }, { topic: "Faces, Edges and Vertices", subtopics: [] }] },
    11: { title: "Mensuration", topics: [{ topic: "Area of Trapezium", subtopics: [] }, { topic: "Area of General Quadrilateral", subtopics: [] }, { topic: "Area of Polygon", subtopics: [] }, { topic: "Solid Shapes", subtopics: ["Surface Area of Cube, Cuboid and Cylinder", "Volume of Cube, Cuboid and Cylinder", "Volume and Capacity"] }] },
    12: { title: "Exponents and Powers", topics: [{ topic: "Powers with Negative Exponents", subtopics: [] }, { topic: "Laws of Exponents", subtopics: [] }, { topic: "Use of Exponents to Express Small Numbers in Standard Form", subtopics: [] }] },
    13: { title: "Direct and Inverse Proportions", topics: [{ topic: "Direct Proportion", subtopics: [] }, { topic: "Inverse Proportion", subtopics: [] }] },
    14: { title: "Factorisation", topics: [{ topic: "What is Factorisation?", subtopics: ["Method of Common Factors", "Factorisation by Regrouping Terms", "Factorisation using Identities", "Factors of the Form (x+a)(x+b)"] }, { topic: "Division of Algebraic Expressions", subtopics: ["Division of a Monomial by another Monomial", "Division of a Polynomial by a Monomial", "Division of a Polynomial by a Polynomial"] }] },
    15: { title: "Introduction to Graphs", topics: [{ topic: "Linear Graphs", subtopics: ["Location of a Point", "Coordinates", "Some Applications"] }] },
    16: { title: "Playing with Numbers", topics: [{ topic: "Numbers in General Form", subtopics: [] }, { topic: "Games with Numbers", subtopics: [] }, { topic: "Letters for Digits", subtopics: [] }, { topic: "Tests of Divisibility", subtopics: [] }] },
  },
  9: {
    1: { title: "Number Systems", topics: [{ topic: "Irrational Numbers", subtopics: [] }, { topic: "Real Numbers and their Decimal Expansions", subtopics: [] }, { topic: "Representing Real Numbers on Number Line", subtopics: [] }, { topic: "Operations on Real Numbers", subtopics: [] }, { topic: "Laws of Exponents for Real Numbers", subtopics: [] }] },
    2: { title: "Polynomials", topics: [{ topic: "Polynomials in One Variable", subtopics: [] }, { topic: "Zeroes of a Polynomial", subtopics: [] }, { topic: "Remainder Theorem", subtopics: [] }, { topic: "Factorisation of Polynomials", subtopics: [] }, { topic: "Algebraic Identities", subtopics: [] }] },
    3: { title: "Coordinate Geometry", topics: [{ topic: "Cartesian System", subtopics: [] }, { topic: "Plotting a Point in the Plane", subtopics: [] }] },
    4: { title: "Linear Equations in Two Variables", topics: [{ topic: "Linear Equations", subtopics: [] }, { topic: "Solution of a Linear Equation", subtopics: [] }, { topic: "Graph of a Linear Equation", subtopics: [] }, { topic: "Equations of Lines Parallel to x-axis and y-axis", subtopics: [] }] },
    5: { title: "Introduction to Euclid's Geometry", topics: [{ topic: "Euclid's Definitions, Axioms and Postulates", subtopics: [] }, { topic: "Equivalent Versions of Euclid's Fifth Postulate", subtopics: [] }] },
    6: { title: "Lines and Angles", topics: [{ topic: "Basic Terms and Definitions", subtopics: [] }, { topic: "Intersecting Lines and Non-intersecting Lines", subtopics: [] }, { topic: "Pairs of Angles", subtopics: [] }, { topic: "Parallel Lines and a Transversal", subtopics: [] }, { topic: "Lines Parallel to the Same Line", subtopics: [] }, { topic: "Angle Sum Property of a Triangle", subtopics: [] }] },
    7: { title: "Triangles", topics: [{ topic: "Congruence of Triangles", subtopics: [] }, { topic: "Criteria for Congruence", subtopics: [] }, { topic: "Some Properties of Triangles", subtopics: [] }, { topic: "Inequalities in a Triangle", subtopics: [] }] },
    8: { title: "Quadrilaterals", topics: [{ topic: "Angle Sum Property", subtopics: [] }, { topic: "Types of Quadrilaterals", subtopics: [] }, { topic: "Properties of Parallelogram", subtopics: [] }, { topic: "Mid Point Theorem", subtopics: [] }] },
    9: { title: "Areas of Parallelograms and Triangles", topics: [{ topic: "Figures on the Same Base and Between the Same Parallels", subtopics: [] }, { topic: "Parallelograms on the Same Base and Between the Same Parallels", subtopics: [] }, { topic: "Triangles on the Same Base and Between the Same Parallels", subtopics: [] }] },
    10: { title: "Circles", topics: [{ topic: "Circles and Related Terms", subtopics: [] }, { topic: "Angle Subtended by a Chord at a Point", subtopics: [] }, { topic: "Perpendicular from Centre to Chord", subtopics: [] }, { topic: "Circle through Three Points", subtopics: [] }, { topic: "Equal Chords and their Distances from Centre", subtopics: [] }, { topic: "Angle Subtended by Arc", subtopics: [] }, { topic: "Cyclic Quadrilaterals", subtopics: [] }] },
    11: { title: "Constructions", topics: [{ topic: "Basic Constructions", subtopics: [] }, { topic: "Some Constructions of Triangles", subtopics: [] }] },
    12: { title: "Heron's Formula", topics: [{ topic: "Area of a Triangle by Heron's Formula", subtopics: [] }, { topic: "Application of Heron's Formula", subtopics: [] }] },
    13: { title: "Surface Areas and Volumes", topics: [{ topic: "Surface Area of a Cuboid and a Cube", subtopics: [] }, { topic: "Surface Area of a Right Circular Cylinder", subtopics: [] }, { topic: "Surface Area of a Right Circular Cone", subtopics: [] }, { topic: "Surface Area of a Sphere", subtopics: [] }, { topic: "Volume of a Cuboid", subtopics: [] }, { topic: "Volume of a Cylinder", subtopics: [] }, { topic: "Volume of a Right Circular Cone", subtopics: [] }, { topic: "Volume of a Sphere", subtopics: [] }] },
    14: { title: "Statistics", topics: [{ topic: "Collection of Data", subtopics: [] }, { topic: "Presentation of Data", subtopics: [] }, { topic: "Graphical Representation", subtopics: ["Bar Graphs", "Histograms", "Frequency Polygons"] }, { topic: "Measures of Central Tendency", subtopics: ["Mean", "Median", "Mode"] }] },
    15: { title: "Probability", topics: [{ topic: "Probability - An Experimental Approach", subtopics: [] }] },
  },
  10: {
    1: { title: "Real Numbers", topics: [{ topic: "Euclid's Division Lemma", subtopics: [] }, { topic: "Fundamental Theorem of Arithmetic", subtopics: [] }, { topic: "Revisiting Irrational Numbers", subtopics: [] }, { topic: "Revisiting Rational Numbers and their Decimal Expansions", subtopics: [] }] },
    2: { title: "Polynomials", topics: [{ topic: "Geometrical Meaning of Zeroes", subtopics: [] }, { topic: "Relationship between Zeroes and Coefficients", subtopics: [] }, { topic: "Division Algorithm for Polynomials", subtopics: [] }] },
    3: { title: "Pair of Linear Equations in Two Variables", topics: [{ topic: "Pair of Linear Equations", subtopics: [] }, { topic: "Graphical Method", subtopics: [] }, { topic: "Algebraic Methods", subtopics: ["Substitution", "Elimination", "Cross-Multiplication"] }, { topic: "Equations Reducible to a Pair of Linear Equations", subtopics: [] }] },
    4: { title: "Quadratic Equations", topics: [{ topic: "Quadratic Equations", subtopics: [] }, { topic: "Solution by Factorisation", subtopics: [] }, { topic: "Solution by Completing the Square", subtopics: [] }, { topic: "Nature of Roots", subtopics: [] }] },
    5: { title: "Arithmetic Progressions", topics: [{ topic: "Arithmetic Progressions", subtopics: [] }, { topic: "nth Term of an AP", subtopics: [] }, { topic: "Sum of First n Terms of an AP", subtopics: [] }] },
    6: { title: "Triangles", topics: [{ topic: "Similar Figures", subtopics: [] }, { topic: "Similarity of Triangles", subtopics: [] }, { topic: "Criteria for Similarity", subtopics: [] }, { topic: "Areas of Similar Triangles", subtopics: [] }, { topic: "Pythagoras Theorem", subtopics: [] }] },
    7: { title: "Coordinate Geometry", topics: [{ topic: "Distance Formula", subtopics: [] }, { topic: "Section Formula", subtopics: [] }, { topic: "Area of a Triangle", subtopics: [] }] },
    8: { title: "Introduction to Trigonometry", topics: [{ topic: "Trigonometric Ratios", subtopics: [] }, { topic: "Trigonometric Ratios of Some Specific Angles", subtopics: [] }, { topic: "Trigonometric Ratios of Complementary Angles", subtopics: [] }, { topic: "Trigonometric Identities", subtopics: [] }] },
    9: { title: "Some Applications of Trigonometry", topics: [{ topic: "Heights and Distances", subtopics: [] }] },
    10: { title: "Circles", topics: [{ topic: "Tangent to a Circle", subtopics: [] }, { topic: "Number of Tangents from a Point", subtopics: [] }] },
    11: { title: "Constructions", topics: [{ topic: "Division of a Line Segment", subtopics: [] }, { topic: "Construction of Tangents to a Circle", subtopics: [] }] },
    12: { title: "Areas Related to Circles", topics: [{ topic: "Perimeter and Area of a Circle", subtopics: [] }, { topic: "Areas of Sector and Segment", subtopics: [] }, { topic: "Areas of Combinations of Plane Figures", subtopics: [] }] },
    13: { title: "Surface Areas and Volumes", topics: [{ topic: "Surface Area of a Combination of Solids", subtopics: [] }, { topic: "Volume of a Combination of Solids", subtopics: [] }, { topic: "Conversion of Solid from One Shape to Another", subtopics: [] }, { topic: "Frustum of a Cone", subtopics: [] }] },
    14: { title: "Statistics", topics: [{ topic: "Mean of Grouped Data", subtopics: [] }, { topic: "Mode of Grouped Data", subtopics: [] }, { topic: "Median of Grouped Data", subtopics: [] }, { topic: "Graphical Representation of Cumulative Frequency Distribution", subtopics: [] }] },
    15: { title: "Probability", topics: [{ topic: "Probability - A Theoretical Approach", subtopics: [] }] },
  },
};

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

function parseScienceChapters(classNum: 8 | 9 | 10): CurriculumChapter[] {
  const chapters = SCIENCE_CHAPTERS[classNum];
  if (!chapters) return [];

  return Object.entries(chapters).map(([numStr, data]) => ({
    id: `science-${classNum}-${numStr}`,
    subject: "science" as const,
    class: classNum,
    number: parseInt(numStr),
    title: data.title,
    topics: data.topics.map((t, i) => ({
      id: `science-${classNum}-${numStr}-${i}`,
      subject: "science" as const,
      class: classNum,
      chapter: data.title,
      topic: t.topic,
      subtopics: t.subtopics,
      keywords: extractKeywords(t.topic, t.subtopics),
      learningObjectives: generateLearningObjectives(t.topic, t.subtopics),
      prerequisites: [],
      difficulty: "introductory" as const,
      estimatedHours: 2,
    })),
  }));
}

function parseMathChapters(classNum: 8 | 9 | 10): CurriculumChapter[] {
  const chapters = MATH_CHAPTERS[classNum];
  if (!chapters) return [];

  return Object.entries(chapters).map(([numStr, data]) => ({
    id: `math-${classNum}-${numStr}`,
    subject: "mathematics" as const,
    class: classNum,
    number: parseInt(numStr),
    title: data.title,
    topics: data.topics.map((t, i) => ({
      id: `math-${classNum}-${numStr}-${i}`,
      subject: "mathematics" as const,
      class: classNum,
      chapter: data.title,
      topic: t.topic,
      subtopics: t.subtopics,
      keywords: extractKeywords(t.topic, t.subtopics),
      learningObjectives: generateLearningObjectives(t.topic, t.subtopics),
      prerequisites: [],
      difficulty: "introductory" as const,
      estimatedHours: 2,
    })),
  }));
}

function extractKeywords(topic: string, subtopics: string[]): string[] {
  const text = `${topic} ${subtopics.join(" ")}`.toLowerCase();
  const keywords = [
    "equation", "formula", "theorem", "proof", "derivation", "calculate", "solve",
    "graph", "function", "variable", "coefficient", "polynomial", "quadratic",
    "triangle", "circle", "angle", "area", "volume", "perimeter", "coordinate",
    "force", "motion", "energy", "velocity", "acceleration", "gravity", "friction",
    "electric", "magnetic", "current", "voltage", "resistance", "circuit", "ohm",
    "light", "reflection", "refraction", "mirror", "lens", "prism", "wave",
    "sound", "frequency", "amplitude", "wavelength", "pitch",
    "chemical", "reaction", "acid", "base", "salt", "ph", "oxidation", "reduction",
    "cell", "atom", "molecule", "element", "compound", "mixture", "periodic",
    "photosynthesis", "respiration", "cell", "tissue", "organ", "dna", "gene",
    "evolution", "ecosystem", "biodiversity", "classification",
  ];
  return keywords.filter((kw) => text.includes(kw));
}

function generateLearningObjectives(topic: string, subtopics: string[]): string[] {
  const objectives = [
    `Understand the concept of ${topic.toLowerCase()}`,
    `Explain the key principles of ${topic.toLowerCase()}`,
  ];
  for (const sub of subtopics.slice(0, 3)) {
    objectives.push(`Describe ${sub.toLowerCase()}`);
  }
  return objectives;
}

export async function loadNCERTCurriculum(): Promise<CurriculumData> {
  const scienceChapters: CurriculumChapter[] = [];
  const mathChapters: CurriculumChapter[] = [];

  for (const classNum of [8, 9, 10] as const) {
    scienceChapters.push(...parseScienceChapters(classNum));
    mathChapters.push(...parseMathChapters(classNum));
  }

  return {
    subjects: {
      science: scienceChapters,
      mathematics: mathChapters,
      physics: [],
      chemistry: [],
      biology: [],
    },
    lastUpdated: new Date().toISOString(),
    source: "NCERT Textbooks (Classes 8-10)",
  };
}

export function searchCurriculum(
  data: CurriculumData,
  query: string,
  filters?: { subject?: string; class?: number; difficulty?: string }
): CurriculumTopic[] {
  const queryLower = query.toLowerCase();
  const results: CurriculumTopic[] = [];

  for (const subject of Object.values(data.subjects)) {
    if (filters?.subject && subject[0]?.subject !== filters.subject) continue;

    for (const chapter of subject) {
      if (filters?.class && chapter.class !== filters.class) continue;

      for (const topic of chapter.topics) {
        if (filters?.difficulty && topic.difficulty !== filters.difficulty) continue;

        const matchText = `${topic.chapter} ${topic.topic} ${topic.subtopics.join(" ")} ${topic.keywords.join(" ")}`.toLowerCase();
        if (matchText.includes(queryLower)) {
          results.push(topic);
        }
      }
    }
  }

  return results;
}

export function getTopicById(data: CurriculumData, id: string): CurriculumTopic | undefined {
  for (const subject of Object.values(data.subjects)) {
    for (const chapter of subject) {
      const topic = chapter.topics.find((t) => t.id === id);
      if (topic) return topic;
    }
  }
  return undefined;
}

export function getChaptersForClass(data: CurriculumData, classNum: number, subject?: string): CurriculumChapter[] {
  const results: CurriculumChapter[] = [];
  for (const [subjName, chapters] of Object.entries(data.subjects)) {
    if (subject && subjName !== subject) continue;
    for (const chapter of chapters) {
      if (chapter.class === classNum) {
        results.push(chapter);
      }
    }
  }
  return results;
}