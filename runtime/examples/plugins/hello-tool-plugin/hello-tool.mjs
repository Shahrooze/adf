export const metadata = { id: "hello", actions: ["greet"] };

export async function execute(args, _ctx) {
  const name = args.name ?? "world";
  return `Hello, ${name}! (from the hello-tool-plugin)`;
}
