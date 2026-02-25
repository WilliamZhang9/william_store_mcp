import { readFileSync } from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const storeDataPath = path.join(process.cwd(), "store-data.json");

function loadStoreData() {
  const content = readFileSync(storeDataPath, "utf8");
  return JSON.parse(content);
}

export function createMcpStoreServer() {
  const server = new McpServer({
    name: "instagram-sell-store-server",
    version: "1.0.0",
    description: "MCP server for an Instagram store catalog and discount policy."
  });

  server.tool(
    "getCategory",
    "Returns high-level categories sold by the store.",
    {},
    async () => {
      const data = loadStoreData();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                categories: data.categories
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.tool(
    "getProductByName",
    "Returns product details by product name.",
    {
      name: z.string().min(1, "Product name is required.")
    },
    async ({ name }) => {
      const data = loadStoreData();
      const normalizedName = name.trim().toLowerCase();
      const product = data.products.find(
        (item) => item.name.toLowerCase() === normalizedName
      );

      if (!product) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: `Product "${name}" not found.`,
                  availableProducts: data.products.map((item) => item.name)
                },
                null,
                2
              )
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                name: product.name,
                category: product.category,
                price: product.price,
                description: product.description,
                picture: product.picture
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  const discountPolicyHandler = async () => {
    const data = loadStoreData();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              discountPolicy: data.discountPolicy
            },
            null,
            2
          )
        }
      ]
    };
  };

  server.tool(
    "getDiscoutpolicy",
    "Returns store discount policy based on order amount tiers.",
    {},
    discountPolicyHandler
  );

  server.tool(
    "getDiscountPolicy",
    "Returns store discount policy based on order amount tiers.",
    {},
    discountPolicyHandler
  );

  return server;
}
