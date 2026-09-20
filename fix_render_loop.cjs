const fs = require('fs');
const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

const target1 = `  // Continuous High performance Canvas 2D Render loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      try {`;

const target2 = `    } catch (err) {
        console.error("MapCanvas render frame error:", err);
      } finally {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };`;

const replace1 = `  const renderRef = useRef<(() => void) | null>(null);

  renderRef.current = () => {
    try {`;

const replace2 = `    } catch (err) {
      console.error("MapCanvas render frame error:", err);
    }
  };

  // Continuous High performance Canvas 2D Render loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      try {
        if (renderRef.current) {
          renderRef.current();
        }
      } finally {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []); // Decoupled from React render cycle!`;

// But wait, there is a massive dependency array after target2!
// We need to remove the dependency array.

let newCode = code.replace(target1, replace1);

if (newCode === code) {
  console.log("Could not find target1");
  process.exit(1);
}

// Find the index of target2
const idx2 = newCode.indexOf(target2);
if (idx2 === -1) {
  console.log("Could not find target2");
  process.exit(1);
}

// Replace target2
newCode = newCode.substring(0, idx2) + replace2 + newCode.substring(idx2 + target2.length);

// Now we need to remove the dependency array and `  }, [` and everything up to `  ]);`
const depStart = newCode.indexOf("  }, [", idx2);
if (depStart !== -1) {
  const depEnd = newCode.indexOf("  ]);", depStart);
  if (depEnd !== -1) {
    newCode = newCode.substring(0, depStart) + newCode.substring(depEnd + 5);
  } else {
    console.log("Could not find end of dependency array");
    process.exit(1);
  }
} else {
  console.log("Could not find start of dependency array");
  process.exit(1);
}

fs.writeFileSync(file, newCode);
console.log("Fixed render loop successfully!");
