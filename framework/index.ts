import path from "path";
import fs from "fs";
import { unified } from "unified";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import remarkHtml from "remark-html";
import yaml from "yaml";
import handlebars from "handlebars";
import tsc from "typescript";
import pascalcase from "pascalcase";

type Config = {
  title: string;
  images: {
    directory: string;
  };
  output: "dist";
};

const config = JSON.parse(
  fs.readFileSync(path.join("../website/config.json")).toString()
) as Config;

// const config = jsonconfig as Config;

const pagesPath = path.resolve("../website/src/pages");
const layoutsPath = path.resolve("../website/src/layouts");
const componentsPath = path.resolve("../website/src/components");
const pageDir = fs.readdirSync(pagesPath);
const componentsDir = fs.readdirSync(componentsPath);

const outputDir = path.join("../website", config.output);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

pageDir.forEach(async (dir) => {
  const index = fs.readFileSync(path.join(pagesPath, dir, "index.md"));
  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkHtml, { sanitize: false })
    .process(index);

  const frontmatter = yaml.parse(
    (
      (await unified()
        .use(remarkParse)
        .use(remarkFrontmatter)
        .parse(index)
        .children.find((child: any) => child.type === "yaml")) as any
    ).value as string
  );

  const {
    layout = "index",
    components = [],
    title,
    date,
    description,
    tags = [],
  } = frontmatter;

  try {
    fs.mkdirSync(path.join(outputDir, dir));
  } catch (_) {}

  // render with handlebars
  const source = fs
    .readFileSync(path.join(layoutsPath, `${layout}.html`))
    .toString();
  const template = handlebars.compile(source);
  const componentData = processComponents(components);

  const data = {
    head: "",
    main: String(file),
    components: componentData,
  };
  const output = template(data);

  fs.writeFileSync(path.join(outputDir, dir, `index.html`), output);

  const otherFiles = fs
    .readdirSync(path.join(pagesPath, dir))
    .filter((file) => {
      if (file.endsWith(".md")) return false;
      return true;
    });

  otherFiles.forEach((file) => {
    try {
      fs.symlinkSync(
        path.join(pagesPath, dir, file),
        path.join(outputDir, dir, file)
      );
    } catch (_) {}
  });
});

componentsDir.forEach((component) => {
  const source = fs.readFileSync(
    path.join(componentsPath, component, "index.ts")
  );

  const transcoded = tsc.transpileModule(source.toString(), {
    compilerOptions: {
      target: tsc.ScriptTarget.ES2019,
      module: tsc.ModuleKind.ES2015,
    },
  });

  try {
    fs.mkdirSync(path.join(outputDir, "scripts"));
  } catch (_) {}

  fs.writeFileSync(
    path.join(outputDir, "scripts", `${component}.js`),
    transcoded.outputText
  );
});

function processComponents(components: string[]) {
  let templates = "";
  let scripts = "";
  components.forEach(async (component) => {
    const template = fs.readFileSync(
      path.join(componentsPath, component, "template.html")
    );
    templates += "\n" + template;

    scripts += `
<script type="module">
import("/scripts/${component}.js").then((module)=>{
    customElements.define("${component}", module["${pascalcase(component)}"]);
})
</script>`;
  });

  return `${templates}
${scripts}`;
}
