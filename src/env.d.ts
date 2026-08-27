/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
	interface Locals {
		identity?: import('./lib/auth').Identity;
	}
}
