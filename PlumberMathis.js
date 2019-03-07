class PlumberMathis {
  constructor(canvas, output) {
    this.level = 1;
    this.canvas = canvas;
    this.canvas.onclick = e => this.canvasClick(e);
    this.output = output;
    this.initCanvas();
    this.status = "first_screen";
    this.map = new GameMap(1);
    this.selectedInput = null;
    this.selectedOutput = null;
  }

  setStatus(status) {
    this.status = status;
  }

  initCanvas() {
    const ctx = this.canvas.getContext("2d");
    ctx.textAlign = "center";
    ctx.font = "30px monospace";
    ctx.fillText(
      "Click to start",
      this.canvas.width / 2,
      this.canvas.height / 2
    );
  }

  drawOutput() {
    let output = "Level " + this.level + " / ";
    if (this.status === "running") {
      let equationText = this.map.levelEquation.label;
      if (this.selectedInput) {
        equationText = equationText.replace("x", this.selectedInput.value);
      }
      if (this.selectedOutput) {
        equationText = equationText.replace("y", this.selectedOutput.value);
      }
      output += equationText;
    }
    output += " / " + this.levelTries + " tries";
    this.output.textContent = output;
  }

  canvasClick(e) {
    switch (this.status) {
      case "first_screen":
        const userMapsize = +prompt("Map size (1 - 6)");
        if (
          !userMapsize ||
          !Number.isInteger(userMapsize) ||
          userMapsize < 1 ||
          userMapsize > 6
        )
          this.map.matrixSize = 10;
        else this.map.matrixSize = 9 + userMapsize;
        this.start();
        break;
      case "running":
        this.select(e);
        break;
    }
  }

  start() {
    this.setStatus("running");
    this.gridSide = this.canvas.height / this.map.matrixSize;
    this.levelTries = 0;
    this.map.regenerate();
    this.drawMap();
    this.drawOutput();
  }

  nextLevel() {
    this.level++;
    this.map.level++;
    this.start();
  }

  select(e) {
    const gridSide = this.gridSide;
    const x = Math.trunc(e.layerX / gridSide);
    const y = Math.trunc(e.layerY / gridSide);

    const selected = this.map.matrix[y][x];
    if (!selected.isSelected) {
      if (!this.selectedInput) {
        this.selectedInput = selected;
        selected.isSelected = true;
      } else if (!this.selectedOutput) {
        this.selectedOutput = selected;
        selected.isSelected = true;
      }
    } else if (selected.isSelected) {
      if (this.selectedInput === selected) {
        this.selectedInput = null;
        selected.isSelected = false;
      } else if (this.selectedOutput === selected) {
        this.selectedOutput = null;
        selected.isSelected = false;
      }
    }

    if (this.selectedInput && this.selectedOutput) {
      this.levelTries++;
      this.try(this.selectedInput, this.selectedOutput);
      this.selectedInput.isSelected = false;
      this.selectedOutput.isSelected = false;
      this.selectedInput = null;
      this.selectedOutput = null;
    }
    this.drawOutput();
    this.drawMap();
  }

  try(input, output) {
    if (
      input.name === "number" &&
      output.name === "number" &&
      this.map.levelEquation.function(input.value) === output.value
    ) {
      const matrix = this.map.matrix;
      matrix[input.y][input.x] = {
        ...matrix[input.y][input.x],
        ...terrainTypes.pipe
      };
      matrix[output.y][output.x] = {
        ...matrix[output.y][output.x],
        ...terrainTypes.pipe
      };
      this.verifyVictory();
    }
  }

  verifyVictory() {
    const matrix = this.map.matrix;
    const tanks = this.map.tanks;
    const goals = this.map.goals;
    const path = [];
    const pathSet = [];
    for (let tank of tanks) {
      this.waterPath(tank, path, pathSet);
    }
    if (goals.every(e => pathSet.includes(e))) {
      this.setStatus("end_animation");
      this.endAnimation(path);
    }
  }

  waterPath(block, path, pathSet, i = 0) {
    const matrix = this.map.matrix;

    const enterPath = (block, path, pathSet, i) => {
      if (!pathSet.includes(block) || i < block.pathInd) {
        if (!path[i]) {
          path.push([]);
        }
        path[i].push(block);
        pathSet.push(block);
        block.pathInd = i;
        return true;
      } else {
        return false;
      }
    };

    if (!enterPath(block, path, pathSet, i)) {
      return;
    }

    let adj = { x: block.x + 1, y: block.y };
    let adjBlock;
    if (adj.x < matrix.length) {
      adjBlock = matrix[adj.y][adj.x];
      if (adjBlock.name === "pipe" || adjBlock.name === "goal")
        this.waterPath(adjBlock, path, pathSet, i + 1);
    }

    adj = { x: block.x - 1, y: block.y };
    if (adj.x >= 0) {
      adjBlock = matrix[adj.y][adj.x];
      if (adjBlock.name === "pipe" || adjBlock.name === "goal")
        this.waterPath(adjBlock, path, pathSet, i + 1);
    }

    adj = { x: block.x, y: block.y + 1 };

    if (adj.y < matrix.length) {
      adjBlock = matrix[adj.y][adj.x];
      if (adjBlock.name === "pipe" || adjBlock.name === "goal")
        this.waterPath(adjBlock, path, pathSet, i + 1);
    }

    adj = { x: block.x, y: block.y - 1 };

    if (adj.y >= 0) {
      adjBlock = matrix[adj.y][adj.x];
      if (adjBlock.name === "pipe" || adjBlock.name === "goal")
        this.waterPath(adjBlock, path, pathSet, i + 1);
    }
  }

  endAnimation(path) {
    path.forEach((step, pI) => {
      step.forEach((block, sI) => {
        if (block.pathInd + 1 < pI) {
          path[pI][sI] = undefined;
        }
      });
      path[pI] = step.filter(block => block !== undefined);
    });
    const cleanPath = path.filter(step => step.length > 0);

    const matrixSize = this.map.matrixSize;
    const ctx = this.canvas.getContext("2d");
    const gridSide = this.gridSide;

    const cicles = 100;
    const cycleTime = (gridSide * gridSide) / 6;

    for (let s = 1; s < cleanPath.length; s++) {
      let origins = cleanPath[s - 1];
      let destinies = cleanPath[s];
      for (let origin of origins) {
        for (let destiny of destinies) {
          if (
            Math.abs(origin.x - destiny.x) + Math.abs(origin.y - destiny.y) ===
            1
          ) {
            let direction;
            if (destiny.x > origin.x) {
              direction = "x+";
            } else if (destiny.x < origin.x) {
              direction = "x-";
            }
            if (destiny.y > origin.y) {
              direction = "y+";
            } else if (destiny.y < origin.y) {
              direction = "y-";
            }

            for (let i = 0; i < cicles; i++) {
              setTimeout(() => {
                let xInc = 0,
                  yInc = 0;

                if (destiny.name === "goal") {
                  if (i > cicles / 2) {
                    ctx.fillStyle = "blue";
                    ctx.beginPath();
                    ctx.arc(
                      destiny.x * gridSide + gridSide / 2,
                      destiny.y * gridSide + gridSide / 2,
                      2 * (i - cicles / 2) * (gridSide / (2 * cicles)),
                      0,
                      2 * Math.PI
                    );
                    ctx.fill();
                  }
                }

                if (direction === "x+") {
                  xInc = gridSide / cicles;
                }
                if (direction === "x-") {
                  xInc = -(gridSide / cicles);
                }
                if (direction === "y+") {
                  yInc = gridSide / cicles;
                }
                if (direction === "y-") {
                  yInc = -(gridSide / cicles);
                }

                ctx.beginPath();
                ctx.strokeStyle = "blue";
                ctx.lineWidth = gridSide / 15;
                ctx.moveTo(
                  origin.x * gridSide + gridSide / 2 + xInc * i,
                  origin.y * gridSide + gridSide / 2 + yInc * i
                );
                ctx.lineTo(
                  origin.x * gridSide + gridSide / 2 + xInc * (i + 1),
                  origin.y * gridSide + gridSide / 2 + yInc * (i + 1)
                );
                ctx.stroke();
              }, s * cycleTime + i * (cycleTime / cicles));
            }
          }
        }
      }
    }
    setTimeout(() => this.nextLevel(), cleanPath.length * cycleTime + 2000);
  }

  drawMap() {
    const matrixSize = this.map.matrixSize;
    const ctx = this.canvas.getContext("2d");
    const gridSide = this.gridSide;
    ctx.clearRect(0, 0, this.canvas.height, this.canvas.height);
    ctx.textAlign = "center";
    ctx.font = Math.trunc(gridSide / 4) + "px monospace";

    for (let x = 0; x < matrixSize; x++) {
      for (let y = 0; y < matrixSize; y++) {
        const terrain = this.map.matrix[y][x];
        this.drawTerrain(terrain, x, y);
      }
    }

    ctx.strokeStyle = "orange";
    ctx.lineWidth = this.gridSide / 15;
    if (this.selectedInput) {
      ctx.strokeRect(
        this.selectedInput.x * gridSide,
        this.selectedInput.y * gridSide,
        gridSide,
        gridSide
      );
    }

    if (this.selectedOutput) {
      ctx.strokeRect(
        this.selectedOutput.x * gridSide,
        this.selectedOutput.y * gridSide,
        gridSide,
        gridSide
      );
    }
  }

  drawTerrain(terrain, x, y) {
    const ctx = this.canvas.getContext("2d");
    const gridSide = this.gridSide;
    switch (terrain.name) {
      case "obstacle":
        ctx.fillStyle = "slategrey";
        ctx.fillRect(x * gridSide, y * gridSide, gridSide, gridSide);
        break;
      case "number":
        ctx.fillStyle = "black";
        ctx.fillText(terrain.value, (x + 0.5) * gridSide, (y + 0.6) * gridSide);
        break;
      case "goal":
        ctx.lineWidth = this.gridSide / 10;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "grey";
        ctx.beginPath();
        ctx.arc(
          x * gridSide + gridSide / 2,
          y * gridSide + gridSide / 2,
          gridSide / 2,
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();

        break;
      case "tank":
        ctx.lineWidth = this.gridSide / 10;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "blue";
        ctx.beginPath();
        ctx.arc(
          x * gridSide + gridSide / 2,
          y * gridSide + gridSide / 2,
          gridSide / 2,
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();
        break;
      case "pipe":
        ctx.fillStyle = "black";

        ctx.fillRect(
          x * gridSide + this.gridSide / 3,
          y * gridSide + this.gridSide / 3,
          this.gridSide / 3,
          this.gridSide / 3
        );
        let adj = { x: x + 1, y };
        let adjTerrain;

        if (adj.x < this.map.matrixSize) {
          adjTerrain = this.map.matrix[adj.y][adj.x];
          if (["pipe", "goal", "tank"].includes(adjTerrain.name)) {
            ctx.fillRect(
              x * gridSide + 2 * (this.gridSide / 3),
              y * gridSide + this.gridSide / 3 + this.gridSide / (3 * 4),
              this.gridSide / 3,
              this.gridSide / 3 - this.gridSide / (3 * 2)
            );
          }
        }
        adj = { x: x - 1, y };
        if (adj.x >= 0) {
          adjTerrain = this.map.matrix[adj.y][adj.x];
          if (["pipe", "goal", "tank"].includes(adjTerrain.name)) {
            ctx.fillRect(
              x * gridSide,
              y * gridSide + this.gridSide / 3 + this.gridSide / (4 * 3),
              this.gridSide / 3,
              this.gridSide / 3 - this.gridSide / (2 * 3)
            );
          }
        }
        adj = { x, y: y + 1 };
        if (adj.y < this.map.matrixSize) {
          adjTerrain = this.map.matrix[adj.y][adj.x];
          if (["pipe", "goal", "tank"].includes(adjTerrain.name)) {
            ctx.fillRect(
              x * gridSide + this.gridSide / 3 + this.gridSide / (3 * 4),
              y * gridSide + 2 * (this.gridSide / 3),
              this.gridSide / 3 - this.gridSide / (3 * 2),
              this.gridSide / 3
            );
          }
        }
        adj = { x, y: y - 1 };
        if (adj.y >= 0) {
          adjTerrain = this.map.matrix[adj.y][adj.x];
          if (["pipe", "goal", "tank"].includes(adjTerrain.name)) {
            ctx.fillRect(
              x * gridSide + this.gridSide / 3 + this.gridSide / (3 * 4),
              y * gridSide,
              this.gridSide / 3 - this.gridSide / (3 * 2),
              this.gridSide / 3
            );
          }
        }
    }
  }
}

class GameMap {
  constructor(level = 1, matrixSize = 10) {
    this.level = level;
    this.matrixSize = matrixSize;
  }

  regenerate() {
    this.tanks = [];
    this.goals = [];
    const matrixSize = this.matrixSize;
    this.levelEquation =
      equations[Math.trunc(Math.random() * equations.length)];

    this.matrix = [];
    const levelTerrain = this.levelTerrain();
    for (let y = 0; y < matrixSize; y++) {
      this.matrix.push([]);
      for (let x = 0; x < matrixSize; x++) {
        let terrain = levelTerrain.pop();
        terrain.x = x;
        terrain.y = y;
        if (terrain.name === "goal") {
          this.goals.push(terrain);
        }
        if (terrain.name === "tank") {
          this.tanks.push(terrain);
        }
        this.matrix[y].push(terrain);
      }
    }
  }

  levelTerrain() {
    const tanksAmount = 2;
    const goalsAmount = this.level < 5 ? this.level + 1 : 4;

    const matrixLength = this.matrixSize ** 2;
    const numbersAmount = matrixLength - tanksAmount - goalsAmount;
    const levelTerrain = [];

    for (let i = 0; i <= Math.ceil(numbersAmount / 2); i++) {
      const pair = this.numberPair();
      const number1 = { ...terrainTypes.number, value: pair[0] };
      const number2 = { ...terrainTypes.number, value: pair[1] };
      levelTerrain.push(number1, number2);
    }
    for (let i = 0; i < tanksAmount - 1; i++) {
      levelTerrain.push({ ...terrainTypes.tank, value: "tank" });
    }
    for (let i = 0; i < goalsAmount - 1; i++) {
      levelTerrain.push({ ...terrainTypes.goal, value: "goal" });
    }

    if (levelTerrain.length % 2 === 1) {
      levelTerrain.push({ ...terrainTypes.obstacle, value: "obstacle" });
    }

    levelTerrain.shuffle();

    let pos = this.matrixSize + Math.trunc(Math.random() * this.matrixSize);
    levelTerrain.splice(pos, 0, { ...terrainTypes.tank, value: "tank" });

    pos =
      matrixLength -
      2 * this.matrixSize +
      Math.trunc(Math.random() * this.matrixSize);

    levelTerrain.splice(pos, 0, { ...terrainTypes.goal, value: "goal" });

    return levelTerrain;
  }

  numberPair() {
    const levelEquation = this.levelEquation;
    const input = Math.trunc(Math.random() * levelEquation.maxInput);
    const output = levelEquation.function(input);
    return [input, output];
  }
}

Array.prototype.shuffle = function() {
  const oldArray = [...this];
  while (oldArray.length > 0) {
    let newItem = oldArray.splice(
      Math.floor(Math.random() * oldArray.length),
      1
    );
    this.push(...newItem);
    this.shift();
  }
  return this;
};

terrainTypes = {
  number: {
    name: "number",
    value: 0,
    isSelected: false
  },
  tank: {
    name: "tank",
    isSelected: false
  },
  goal: {
    name: "goal",
    isSelected: false,
    reached: false
  },
  obstacle: {
    name: "obstacle",
    isSelected: false
  },
  pipe: {
    name: "pipe",
    isSelected: false
  }
};

const equations = [
  { label: "x^2 = y", function: x => x ** 2, maxInput: 10 },
  { label: "x^3 = y", function: x => x ** 3, maxInput: 10 },
  { label: "x * 2  = y", function: x => x * 2, maxInput: 50 },
  { label: "x + 16  = y", function: x => x + 16, maxInput: 50 },
  { label: "x + 21  = y", function: x => x + 21, maxInput: 50 },
  { label: "x + 7  = y", function: x => x + 7, maxInput: 50 },
  { label: "x + 45  = y", function: x => x + 45, maxInput: 50 },
  { label: "x + 3  = y", function: x => x + 3, maxInput: 50 },
  { label: "x * 3  = y", function: x => x * 3, maxInput: 33 },
  { label: "x * 4  = y", function: x => x * 4, maxInput: 25 },
  { label: "x * 5  = y", function: x => x * 5, maxInput: 20 },
  { label: "x * 6  = y", function: x => x * 6, maxInput: 17 },
  { label: "x * 7  = y", function: x => x * 7, maxInput: 15 }
];

const canvas = document.querySelector("#gameCanvas");
const output = document.querySelector("#info");

new PlumberMathis(canvas, output);
