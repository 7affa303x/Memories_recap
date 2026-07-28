import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Memory Recap — Turn heavy memories into watchable moments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #ecfdf5 0%, #ffffff 45%, #f0fdf4 100%)",
          padding: 72,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 600,
            color: "#14532d",
            letterSpacing: -0.5,
          }}
        >
          Memory Recap
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: "#171717",
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 900,
            }}
          >
            Turn heavy memories into watchable moments.
          </div>
          <div style={{ fontSize: 28, color: "#525252", maxWidth: 780 }}>
            Upload → pay → wait → receive a calm landscape + vertical recap.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
