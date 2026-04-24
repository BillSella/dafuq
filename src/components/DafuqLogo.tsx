import { type Component } from "solid-js";
import logoPng from "../assets/dafuq-logo.png";

/** Line-art mark rendered as the asset: no filter or color mask. */
export const DafuqLogo: Component = () => {
  return (
    <img
      class="app-logo-image"
      src={logoPng}
      alt="dafuq"
      width="56"
      height="56"
      loading="eager"
      decoding="async"
    />
  );
};
