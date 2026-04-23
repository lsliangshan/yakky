import { templatesPath } from "../utils/paths";

export async function template(args?: any) {
  console.log("2模板: ", templatesPath());
  // logger.info("Starting project initialization...\n");

  // const response = await Enquirer.prompt<InitAnswers>([
  //   {
  //     type: "input",
  //     name: "projectName",
  //     message: "What is the project name?",
  //     initial: "my-project",
  //   },
  //   {
  //     type: "input",
  //     name: "description",
  //     message: "What is the project description?",
  //     initial: "",
  //   },
  //   {
  //     type: "input",
  //     name: "author",
  //     message: "Who is the author?",
  //     initial: "",
  //   },
  //   {
  //     type: "confirm",
  //     name: "confirm",
  //     message: "Create project with these details?",
  //     initial: true,
  //   },
  // ]);

  // if (!response.confirm) {
  //   logger.warn("Initialization cancelled.");
  //   return null;
  // }

  // logger.success("\nProject initialized!");
  // logger.highlight(`  Name:        ${response.projectName}`);
  // logger.highlight(`  Description: ${response.description || "(none)"}`);
  // logger.highlight(`  Author:      ${response.author || "(none)"}`);

  // return response;
}
