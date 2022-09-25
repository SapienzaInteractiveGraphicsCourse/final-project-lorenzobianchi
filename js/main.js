import * as THREE from './libs/threejs/build/three.module.js';
import TWEEN from './libs/tween.esm.js'; // https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@18.5.0/dist/tween.esm.js
import { GLTFLoader } from './libs/threejs/examples/jsm/loaders/GLTFLoader.js';
import { OutlineEffect } from './libs/threejs/examples/jsm/effects/OutlineEffect.js';

// General
var scene, camera, listener, sound, music, renderer, effect, clock, gltfLoader, audioLoader, ambientLight, directLight, skyColor;

// Tweens
var ring_rotation_tween, head_rotation_tween, cylinder_rotation_tween, running_tween;
var runningAnimationTweens = [];

var theme = 1; // 0 -> city, 1 -> countryside

const container = document.getElementById( 'container' );

const boxGeometry = new THREE.BoxGeometry( 1, 1, 1 );
const boxMaterial = new THREE.MeshStandardMaterial( {color: 0xffffff} );
const boxCollisionMaterial = new THREE.MeshStandardMaterial( {color: 0xffffff, transparent: true, opacity: .2});

// Collisions
var playerCollisionBox;
var activeCollisionBoxes = []; // remove things when no more visible

var objects;
var hits = [];
var chunks = [];

var eggmanSpawn = false;
var isHit = false;


var settings = {
	game: {
		  velocity: 2.5, // easy: 2, normal: 2.5, hard: 3
		  end: -100000,
		  isPaused: true,
		  isGameStarted: false,
		  isGameEnded: false,
	},	
	showCollisionBoxes: false,   
	showFog: true,
};

var sonic = {
	// Model
	mesh: new THREE.Object3D(),
	bones: {
		left: {},
		right: {},
	},
	// State
	health: 3,
	rings: 0,
	// Game parameters
	isJumping: false,
	isSliding: false,
	jumpTime: 300,
	jumpHeigth: 8,
	slideTime: 300,
	slideAngle: 160,
	positions: { 
		left: -8.5,
		right: 8.5,
		center: 0,
	},
};


var eggman = {
	// Model
	mesh: new THREE.Object3D(),
	bones: {
		left: {},
		right: {},
	},
};

const models = {
	sonic:      { url: './assets/characters/sonic/scene.gltf' },
	ring: 	    { url: './assets/items/ring/scene.gltf' },
	sonic_head: { url: './assets/items/sonic_head/scene.gltf' },
	cylinder:   { url: './assets/items/cylinder/scene.gltf' },
	trap:	    { url: './assets/items/trap/scene.gltf' },
	eggman:		{ url: './assets/characters/eggman/scene.gltf' },
	tree:		{ url: './assets/items/tree/scene.gltf' },
	bush:		{ url: './assets/items/bush/scene.gltf' },
	lamp:		{ url: './assets/items/lamp/scene.gltf' },
};

const sounds = {
	background:  { url: './assets/sounds/soundtrack.mp3' },
	start_voice: { url: './assets/sounds/start_voice.wav' },
	jump : 		 { url: './assets/sounds/jump.wav' },
	slide : 	 { url: './assets/sounds/slide.wav' },
	oneup : 	 { url: './assets/sounds/1up.mp3' },
	ring: 		 { url: './assets/sounds/ring_collect.mp3' },
	damage: 	 { url: './assets/sounds/damage.mp3' },
	damage_voice:{ url: './assets/sounds/damage_voice.wav' },
	eggman: 	 { url: './assets/sounds/eggman.wav' },
	eggman_voice:{ url: './assets/sounds/eggman_voice.wav' },
	gameover: 	 { url: './assets/sounds/gameover.mp3' },
}

// Loading assets
var areModelsLoaded = false;
var areSoundsLoaded = false;

// Loading models
loadModels();
loadSounds();

function loadModels() {

	const modelsLoaderManager = new THREE.LoadingManager();
	modelsLoaderManager.onLoad = () => {

		areModelsLoaded = true;

		// hide the loading bar
		document.querySelector('#models_loading').hidden = true;

		if(areModelsLoaded & areSoundsLoaded) {
			init();
		}
	};

	const modelsProgressBar = document.querySelector('#models_progressbar');
	modelsLoaderManager.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading models... ", itemsLoaded / itemsTotal * 100, '%');
		modelsProgressBar.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
	};
	{
		const gltfLoader = new GLTFLoader(modelsLoaderManager);
		for (const model of Object.values(models)) {
			gltfLoader.load(model.url, (gltf) => {

				gltf.scene.traverse( function ( child ) {

					if ( child.isMesh ) {
						if( child.castShadow !== undefined ) {
							child.castShadow = true;
							child.receiveShadow = true;
						}
					}
			
				} );

				model.gltf = gltf.scene;
				
			});
		}
	} 
}

function loadSounds() {

	const soundsLoaderManager = new THREE.LoadingManager();
	soundsLoaderManager.onLoad = () => {

		areSoundsLoaded = true;

		// hide the loading bar
		document.querySelector('#sounds_loading').hidden = true;

		if(areModelsLoaded & areSoundsLoaded) {
			init();
		}
	};

	const modelsProgressBar = document.querySelector('#sounds_progressbar');
	soundsLoaderManager.onProgress = (url, itemsLoaded, itemsTotal) => {
		console.log("Loading sounds... ", itemsLoaded / itemsTotal * 100, '%');
		modelsProgressBar.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
	};
	{
		const audioLoader = new THREE.AudioLoader(soundsLoaderManager);
		for (const sound of Object.values(sounds)) {
			audioLoader.load( sound.url, function( buffer ) {
				
				sound.sound = buffer;

				console.log("Loaded ", buffer);
			});
		}
	} 
}


function init(){
	
	document.getElementById("main_menu").hidden = false;

	camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 0.1, 300 );
	camera.position.z = 30;
	camera.position.y = 15; // 8
	camera.lookAt(0, 1, 0);
	
	// create an AudioListener and add it to the camera
	listener = new THREE.AudioListener();
	camera.add( listener );

	// create a global audio source
	sound = new THREE.Audio( listener );
	music = new THREE.Audio( listener );

	renderer = new THREE.WebGLRenderer( {antialias: true} );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
	renderer.setPixelRatio(devicePixelRatio);
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.gammaFactor = 2.2;
	renderer.outputEncoding = THREE.sRGBEncoding;
	container.appendChild( renderer.domElement );

	clock = new THREE.Clock(false);
	
	audioLoader = new THREE.AudioLoader();

	initEventListeners();
}

function initSonic() {

	sonic.mesh = new THREE.Object3D();

	sonic.mesh.name = "sonic";

	sonic.mesh.position.set(0, 0, 5);
	sonic.mesh.rotation.set(0, Math.PI, 0);

	let body = models.sonic.gltf.getObjectByName('Root');
	body.scale.set(1.5, 1.5, 1.5);

	var dcube =  new THREE.Mesh(boxGeometry, boxCollisionMaterial);
	dcube.name = "playerCollisionBox"
	dcube.scale.set(4, 4, 5.5);
	dcube.position.set(0, 0, 4.5);
	dcube.visible = settings.showCollisionBoxes;

	playerCollisionBox = dcube;

	sonic.mesh.add(body);
	sonic.mesh.add(playerCollisionBox);

	sonic.mesh.castShadow = true;


	console.log("******* sonic *******\n", dumpObject(sonic.mesh).join('\n'));
	scene.add(sonic.mesh);

	setSonicBones();

}

function rotateRing(ring) {
	var rotation = { z: 0 };
	ring_rotation_tween = new TWEEN.Tween(rotation)
	.to({ z: degtorad(360) }, 2500) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( () => { 
		ring.rotation.z = rotation.z; // update rotation
	})
	.start();
}

function rotateHead(head) {
	var rotation = { y: 0 };
	head_rotation_tween = new TWEEN.Tween(rotation)
	.to({ y: degtorad(-360) }, 2500) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( () => { 
		head.rotation.y = rotation.y; // update rotation
	})
	.start();
}

function rotateCylinder(cyl) {

	var rotation = { x: 0 };
	cylinder_rotation_tween = new TWEEN.Tween(rotation)
	.to({ x: degtorad(360) }, 2500) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( () => { 
		cyl.rotation.x = rotation.x; // update rotation
	})
	.start();
}

function init_mat(rows, cols) {
	var mat = new Array(rows);
	for (var x = 0; x < rows; x++) {
		mat[x] = new Array(3);
	}

	for (var i=0; i<rows; i++) {
		for (var j=0; j<cols; j++){
			mat[i][j] = 0;
		}
	}

	return mat;
}

function print_mat(obs_slots){
	console.log("Matrix: ");
	for (var i=0; i<2; i++) {
		for (var j=0; j<3; j++){
			console.log(i+","+j+": "+obs_slots[i][j]);
		}
	}
}

function eggmanJumpRight(x_pos) {

	var position = { x: eggman.mesh.position.x, y: eggman.mesh.position.y }; 

	// JUMP RIGHT
	var tween_start_jumping_right = new TWEEN.Tween(position)
		.to({ x: x_pos += 4, y: 5 }, 200) 
		.easing(TWEEN.Easing.Quadratic.In)
		.onUpdate( () => { 
			eggman.mesh.position.y = position.y;
			eggman.mesh.position.x = position.x; 
		} );

	var tween_end_jumping_right = new TWEEN.Tween(position)
		.to({ x: x_pos += 5, y: -0.5 }, 200) 
		.easing(TWEEN.Easing.Quadratic.Out)
		.onUpdate( () => { 
			eggman.mesh.position.y = position.y; 
			eggman.mesh.position.x = position.x;
		} );

	tween_start_jumping_right.onComplete( () => { tween_end_jumping_right.start(); });

	tween_end_jumping_right.onComplete( () => {	(x_pos > 0)? eggmanJumpLeft(x_pos) : eggmanJumpRight(x_pos) });

	tween_start_jumping_right.start();

}


function eggmanJumpLeft(x_pos) {

	var position = { x: eggman.mesh.position.x, y: eggman.mesh.position.y }; 

	// JUMP LEFT
	var tween_start_jumping_left = new TWEEN.Tween(position)
		.to({ x: x_pos -= 4, y: 5 }, 200) 
		.easing(TWEEN.Easing.Quadratic.In)
		.onUpdate( () => { 
			eggman.mesh.position.y = position.y;
			eggman.mesh.position.x = position.x; 
		} );

	var tween_end_jumping_left = new TWEEN.Tween(position)
		.to({ x: x_pos -= 5, y: -0.5 }, 200) 
		.easing(TWEEN.Easing.Quadratic.Out)
		.onUpdate( () => { 
			eggman.mesh.position.y = position.y; 
			eggman.mesh.position.x = position.x;
		} );

	tween_start_jumping_left.onComplete( () => { tween_end_jumping_left.start(); });

	tween_end_jumping_left.onComplete( () => { (x_pos < 0)? eggmanJumpRight(x_pos) : eggmanJumpLeft(x_pos) });

	tween_start_jumping_left.start();


}

function playEggmanAnimation() {

	eggmanJumpRight(eggman.mesh.position.x);

	// RIGHT ARM
	var right_upperarm_start = { x: -250, y: -60, z: -150 };
	var right_upperarm_tween_start_step = new TWEEN.Tween(right_upperarm_start)
	.to({ x: -180, y: -20, z: -200 }, 300) 
	.easing(TWEEN.Easing.Cubic.In)
	.onUpdate( 
				() => {
					eggman.bones.right.upperarm.rotation.x = degtorad( right_upperarm_start.x );
					eggman.bones.right.upperarm.rotation.y = degtorad( right_upperarm_start.y );
					eggman.bones.right.upperarm.rotation.z = degtorad( right_upperarm_start.z );

					
				}
	);

	var right_upperarm_tween_start_step_reverse = new TWEEN.Tween(right_upperarm_start)
	.to({ x: -250, y: -60, z: -150 }, 800) 
	.easing(TWEEN.Easing.Cubic.Out)
	.onUpdate( 
				() => {
					eggman.bones.right.upperarm.rotation.x = degtorad( right_upperarm_start.x );
					eggman.bones.right.upperarm.rotation.y = degtorad( right_upperarm_start.y );
					eggman.bones.right.upperarm.rotation.z = degtorad( right_upperarm_start.z );
				}
	);

	right_upperarm_tween_start_step.onComplete( () => { right_upperarm_tween_start_step_reverse.start(); });
	right_upperarm_tween_start_step_reverse.onComplete( () => { right_upperarm_tween_start_step.start(); });

	right_upperarm_tween_start_step.start();


	// LEFT ARM
	var left_upperarm_start = { x: 150, y: 50, z: 50 };
	var left_upperarm_tween_start_step = new TWEEN.Tween(left_upperarm_start)
	.to({ x: 150, y:-20, z: 120 }, 300) 
	.easing(TWEEN.Easing.Cubic.In)
	.onUpdate( 
				() => {
					eggman.bones.left.upperarm.rotation.x = degtorad( left_upperarm_start.x );
					eggman.bones.left.upperarm.rotation.y = degtorad( left_upperarm_start.y );
					eggman.bones.left.upperarm.rotation.z = degtorad( left_upperarm_start.z );
				}
	);

	var left_upperarm_tween_start_step_reverse = new TWEEN.Tween(left_upperarm_start)
	.to({ x: 150, y:50, z: 50 }, 800) 
	.easing(TWEEN.Easing.Cubic.Out)
	.onUpdate( 
				() => {
					eggman.bones.left.upperarm.rotation.x = degtorad( left_upperarm_start.x );
					eggman.bones.left.upperarm.rotation.y = degtorad( left_upperarm_start.y );
					eggman.bones.left.upperarm.rotation.z = degtorad( left_upperarm_start.z );
				}
	);

	left_upperarm_tween_start_step.onComplete( () => { left_upperarm_tween_start_step_reverse.start(); });
	left_upperarm_tween_start_step_reverse.onComplete( () => { left_upperarm_tween_start_step.start(); });

	left_upperarm_tween_start_step.start();
	  
	// KNEES
	var knee = {z: -260 };
	var knee_tween_start_step = new TWEEN.Tween(knee)
	.to({ z: -230 }, 200) 
	.easing(TWEEN.Easing.Cubic.In)
	.onUpdate( 
				() => {
					eggman.bones.left.knee.rotation.z = degtorad(-knee.z);
					eggman.bones.right.knee.rotation.z = degtorad(knee.z);
				}
	);

	var knee_reverse_tween_start_step = new TWEEN.Tween(knee)
	.to({ z: -260 }, 200) 
	.easing(TWEEN.Easing.Cubic.In)
	.onUpdate( 
				() => {
					eggman.bones.left.knee.rotation.z = degtorad(-knee.z);
					eggman.bones.right.knee.rotation.z = degtorad(knee.z);
				}
	);


	knee_tween_start_step.onComplete( () => { knee_reverse_tween_start_step.start(); });
	knee_reverse_tween_start_step.onComplete( () => { knee_tween_start_step.start(); });

	knee_tween_start_step.start();
}


function initEggman(z_pos){
	
		eggman.mesh = new THREE.Object3D();
		eggman.mesh.name = "eggman";
	
		eggman.mesh.position.set(0, 0, z_pos);
		eggman.mesh.rotation.set(0, Math.PI/2, 0);
	
		let body = models.eggman.gltf.getObjectByName('RootNode');
		body.scale.set(.00065, .00065, .00065);
	/*
		var dcube =  new THREE.Mesh(boxGeometry, boxCollisionMaterial);
		dcube.name = "collisionBox"
		dcube.scale.set(10, 10, 15);
		dcube.position.set(0, 5, 0);
		dcube.visible = settings.showCollisionBoxes;
	
		playerCollisionBox = dcube;
		eggman.mesh.add(playerCollisionBox);
	*/
		eggman.mesh.add(body);
				
		setEggmanBones();
		playEggmanAnimation();

		eggmanSpawn = true;
}


function cleanObjects() {

	var toRemove = [];

	objects.traverse( function ( object ) {
			if(sonic.mesh.position.z < object.position.z - 50){
				toRemove.push(object);
			}
	});

	toRemove.forEach( (object) => {
		objects.remove(object);
	});	
}

function spawnObjects(z_pos) {

	// ------------- PREPARE OBJECTS POSITION ------------

	var num_rings, x_pos_ring, y_pos_ring;
	var p_amount, p_x_ring, p_height_ring, p_height_obstacles;

	var ring_slots = init_mat(2, 3);
	var obs_slots = init_mat(2, 3);

	// RINGS
	p_amount = Math.random();
	if (p_amount < 0.5) num_rings = 2;
	else if (p_amount > 0.7) num_rings = 3;
	else num_rings = 4;
	
	p_x_ring = Math.random();
	// left lane
	if (p_x_ring < 0.33) { 
		x_pos_ring = -8.5;
		
		p_height_ring = Math.random();
		// up
		if (p_height_ring < 0.5) {
			y_pos_ring = 10;
			ring_slots[0][0] = 1;
		}
		// down
		else{
			y_pos_ring = 3;
			ring_slots[1][0] = 1;
		}
	} 
	// center lane
	else if (p_x_ring > 0.66) {
		x_pos_ring = 0;

		p_height_ring = Math.random();
		// up
		if (p_height_ring < 0.5) {
			y_pos_ring = 10;
			ring_slots[0][1] = 1;
		}
		// down
		else{
			y_pos_ring = 3;
			ring_slots[1][1] = 1;
		}
	} 
	// right lane
	else{
		x_pos_ring = 8.5;

		p_height_ring = Math.random();
		// up
		if (p_height_ring < 0.5) {
			y_pos_ring = 10;
			ring_slots[0][2] = 1;
		}
		// down
		else{
			y_pos_ring = 3;
			ring_slots[1][2] = 1;
		}
	}

	// OBSTACLES
	var num_cyls = 0;
	var num_spikes = 0;
	var cyls =  new Array(3);
	var spikes = new Array(3);
	var cylinder_x_pos = [-4, 4.5, 13];
	var cylinder_y_pos = 7.5;
	var spike_x_pos = [-8.5, 0, 8.5];
	var spike_y_pos = 0;

	// LEFT LANE
	p_height_obstacles = Math.random();
	// up
	if (p_height_obstacles < 0.5 && !ring_slots[0][0] && !obs_slots[1][0] ) {
		cyls[0] = cylinder_x_pos[0];
		num_cyls++;
		obs_slots[0][0] = 1;

		// if its first right_slot is empty fill it
		if (!ring_slots[0][1] && !obs_slots[0][1]) {
			cyls[1] = cylinder_x_pos[1];
			num_cyls++;
			obs_slots[0][1] = 1;

			// if its second right slot is empty fill it
			if (!ring_slots[0][2] && !obs_slots[0][2] ) {
				cyls[2] = cylinder_x_pos[2];
				num_cyls++;
				obs_slots[0][2] = 1;				
			}
		}
	}
	// down
	else if (p_height_obstacles >= 0.5 && !ring_slots[1][0] && !obs_slots[0][0]) {
		spikes[0] = spike_x_pos[0];
		num_spikes++;
		obs_slots[1][0] = 1;

		// if its right slot is empty fill it
		if (!ring_slots[1][1] && !obs_slots[1][1]) {
			spikes[1] = spike_x_pos[1];
			num_spikes++;
			obs_slots[1][1] = 1;

			// if its second right slot is empty fill it
			if (!ring_slots[1][2] && !obs_slots[1][2]) {
				spikes[2] = spike_x_pos[2];
				num_spikes++;
				obs_slots[1][2] = 1;				
			}
		}
	}

	// CENTER LANE
	p_height_obstacles = Math.random();
	// up
	if (p_height_obstacles < 0.5 && !ring_slots[0][1] && !obs_slots[1][1] ) {
		cyls[0] = cylinder_x_pos[1];
		num_cyls++;
		obs_slots[0][1] = 1;

		// if its right slot is empty fill it
		if (!ring_slots[0][2] && !obs_slots[0][2]) {
			cyls[1] = cylinder_x_pos[2];
			num_cyls++;
			obs_slots[0][2] = 1;
		}
	}
	// down
	else if(p_height_obstacles >= 0.5 && !ring_slots[1][1] && !obs_slots[0][1]) {
		spikes[0] = spike_x_pos[1];
		num_spikes++;
		obs_slots[1][1] = 1;

		// if its right slot is empty fill it
		if (!ring_slots[1][2] && !obs_slots[1][2]) {
			spikes[1] = spike_x_pos[2];
			num_spikes++;
			obs_slots[1][2] = 1;
		}
	}

	// RIGHT LANE
	p_height_obstacles = Math.random();
	// up
	if (p_height_obstacles < 0.5 && !ring_slots[0][2] && !obs_slots[1][2] ) {
		cyls[0] = cylinder_x_pos[2];
		num_cyls++;
		obs_slots[0][2] = 1;
	}
	// down
	else if(p_height_obstacles >= 0.5 && !ring_slots[1][2] && !obs_slots[0][2]) {
		spikes[0] = spike_x_pos[2];
		num_spikes++;
		obs_slots[1][2] = 1;
	}
	
	// -------------- SPAWN OBJECTS ---------------

	var p_enemy = Math.random();
	var p_spawn_eggman = 0.05; // 0.05

	var p_bonus = Math.random();
	var p_extra_life = 0.03; // 0.03

	// EGGMAN
	if (p_enemy < p_spawn_eggman) {
		if(!eggmanSpawn) initEggman(z_pos);

		eggman.mesh.position.set(0, 0, z_pos);
		eggman.mesh.rotation.set(0, Math.PI/2, 0);
		
		playEggmanSpawnSound();

		scene.add(eggman.mesh);	

	}
	else {
		// BONUS	
		if (p_bonus > p_extra_life) {
			// RINGS
			for (var i=0; i < num_rings; i++) {
				var ring = new THREE.Object3D();
				ring.name = "ring";
			
				let body = models.ring.gltf.clone();

				// Create box to check collision with
				var ocube = makeObjectCollisionBox(); 

				ring.scale.set(.05,.05,.05);
				ring.rotation.x = degtorad(90);

				rotateRing(ring);

				ring.add(body);
				ring.add(ocube);
			
				ring.position.set(x_pos_ring, y_pos_ring, z_pos-15);
				
				scene.add(ring);
				z_pos -= 10;

				objects.add(ring);
			}
		} else {
				// SONIC HEAD
				if(sonic.health < 5) {
					var sonic_head = new THREE.Object3D();
					sonic_head.name = "sonic_head";

					let body = models.sonic_head.gltf.clone();

					// Create box to check collision with
					var ocube = makeObjectCollisionBox(); 
					ocube.position.set(0, 60, 0);

					sonic_head.scale.set(.05,.05,.05);

					rotateHead(sonic_head);

					sonic_head.add(body);
					sonic_head.add(ocube);

					sonic_head.position.set(x_pos_ring, y_pos_ring - 3, z_pos);
					
					scene.add(sonic_head);

					objects.add(sonic_head);
				}

		}

		// OBSTACLES
		if (num_cyls || num_spikes) {
			// SPIKE TRAPS
			for (var s=0; s < num_spikes; s++) {

				var trap = new THREE.Object3D();
				trap.name = "trap";

				let body = models.trap.gltf.clone();

				// Create box to check collision with
				var ocube = makeObjectCollisionBox(); 
				trap.scale.set(.015,.013,.015);				
				ocube.scale.set(400, 700, 400);

				trap.add(body);
				trap.add(ocube);

				trap.position.set(spikes[s], spike_y_pos, z_pos);
				trap.castShadow = false;

				scene.add(trap);

				objects.add(trap);

			}
			// CYLIDERS
			for (var c=0; c < num_cyls; c++) {

				var cylinder = new THREE.Object3D();
				cylinder.name = "cylinder";

				let body = models.cylinder.gltf.clone();

				// Create box to check collision with
				var ocube = makeObjectCollisionBox(); 
				ocube.position.set(0, 100, 0);
				ocube.scale.set(200, 200, 200);


				cylinder.scale.set(.035,.045,.035);
				cylinder.rotation.z = degtorad(90);
				
				rotateCylinder(cylinder);
				cylinder.add(body);
				cylinder.add(ocube);

				cylinder.position.set(cyls[c], cylinder_y_pos, z_pos);

				scene.add(cylinder);

				objects.add(cylinder);

			}
		}
	}
	
	//print_mat(ring_slots);
	//print_mat(obs_slots);
}

function makeObjectCollisionBox() {

	let ocube = new THREE.Mesh(boxGeometry, boxCollisionMaterial);
	ocube.scale.set(100, 100, 100);
	ocube.position.set(0, 0, 0);
	ocube.name = "collisionBox";
	ocube.visible = settings.showCollisionBoxes;

	return ocube;

}

function initChunks() {

	var geometry = new THREE.BoxGeometry( 1, 1, 1 );

	// CITY
	if(theme) {
		var texture = new THREE.TextureLoader().load( './assets/images/sand1.jpeg' );
		var material = new THREE.MeshStandardMaterial( { map: texture } );

		var texture_background = new THREE.TextureLoader().load( './assets/images/grass3.jpg' );
		var material_background = new THREE.MeshStandardMaterial( { map: texture_background } );
	}
	// COUNTRYSIDE
	else {
		var texture = new THREE.TextureLoader().load( './assets/images/road1.jpeg' );
		var material = new THREE.MeshStandardMaterial( { map: texture } );

		var texture_background = new THREE.TextureLoader().load( './assets/images/sidewalk.jpeg' );
		var material_background = new THREE.MeshStandardMaterial( { map: texture_background } );

	}

	let pos = 30;

	// INITIAL MAIN ROAD CHUNKS
	while (pos > -180) {
		let mesh = new THREE.Mesh( geometry, material );
		//mesh.scale.set(25, 1, 150);
		mesh.scale.set(30, .1, 30);
		mesh.position.y = -.5;
		mesh.position.z = pos;
		//mesh.castShadow = true;
		mesh.receiveShadow = true;
		scene.add(mesh);

		chunks.push(mesh);


		// INITIAL LEFT CHUNKS
		for(var i = -5; i < 0; i++){
			let mesh = new THREE.Mesh( geometry, material_background );
			//mesh.scale.set(25, 1, 150);
			mesh.scale.set(30, .1, 30);

			mesh.position.x = i * 30 - 0.15;
			mesh.position.y = -.5;
			mesh.position.z = pos;
			//mesh.castShadow = true;
			mesh.receiveShadow = true;
			scene.add(mesh);

			chunks.push(mesh);

		}

		// INITIAL RIGHT CHUNKS
		for(var i = 1; i < 5; i++){
			let mesh = new THREE.Mesh( geometry, material_background );
			//mesh.scale.set(25, 1, 150);
			mesh.scale.set(30, .1, 30);

			mesh.position.x = i * 30 + 0.15;
			mesh.position.y = -.5;
			mesh.position.z = pos;
			//mesh.castShadow = true;
			mesh.receiveShadow = true;
			scene.add(mesh);

			chunks.push(mesh);
		}

		pos -= 30;

	}

}

function initScene() {

	scene = new THREE.Scene();

	(theme)? skyColor = 0xE0FFFF : skyColor = 0x203544 ; // NIGHT MODE: 0x203544
	
	scene.background = new THREE.Color( skyColor );

	// FOG
	if(settings.showFog) scene.fog = new THREE.Fog( skyColor, 0.1, 180 );
	
	// LIGHTS
	(theme)? ambientLight = new THREE.AmbientLight(0xffffff, 0.8) : ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
	scene.add(ambientLight);

	(theme)? directLight = new THREE.DirectionalLight(0xffffff, 3) : directLight = new THREE.DirectionalLight(0xffffff, 2);

	directLight.position.set(0, 50, sonic.mesh.position.z + 20);
	
	var directLightTargetObject = new THREE.Object3D();
	directLightTargetObject.position.set(0, 0, sonic.mesh.position.z + 20);
	scene.add(directLightTargetObject);
	directLight.target = directLightTargetObject;

	setInterval(function() { 
		directLight.position.z = sonic.mesh.position.z + 20;
		directLightTargetObject.position.z = sonic.mesh.position.z + 20;
		scene.add(directLightTargetObject);
		directLight.target = directLightTargetObject;
	}, 1000);

	
	directLight.castShadow = true;
	directLight.shadow.mapSize.width = 512;
	directLight.shadow.mapSize.height = 512;

	const d = 60;
	directLight.shadow.camera.left = -20;
	directLight.shadow.camera.right = 20;
	directLight.shadow.camera.top = 140;
	directLight.shadow.camera.bottom = 0;
	directLight.shadow.camera.near = 30;
	directLight.shadow.camera.far = 55;
	directLight.shadow.bias = 0.0009;

	scene.add(directLight);
}


function initObjects() {

	objects = new THREE.Group();
	scene.add(objects);

}


function movesonicTo( target_position ) {
	
	// animated movement
	var position = { x: sonic.mesh.position.x }; // Start at (0, 0)
	var move_sonic_tween = new TWEEN.Tween(position)
	.to({ x: target_position }, 200)
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.mesh.position.x = position.x;
				}
	).start();

}

function moveLeft() {

	if(settings.game.isPaused) return;

	//if(sonic.isJumping || sonic.isSliding) return;

	// if at the right position (position.x == rightPosition): movesonicTo(centerPosition)
	if(sonic.mesh.position.x == sonic.positions.right) {
		movesonicTo(sonic.positions.center);
		return;
	}

	// if already at left position  (position.x == leftPosition) : return
	if(sonic.mesh.position.x == sonic.positions.left) return;

	movesonicTo(sonic.positions.left);
}

function moveRight() {

	if(settings.game.isPaused) return;

	//if(sonic.isJumping || sonic.isSliding) return;

	// if at the left position : movesonicTo(centerPosition)
	if(sonic.mesh.position.x == sonic.positions.left) {
		movesonicTo(sonic.positions.center);
		return;
	}

	// if already at right position : return
	if(sonic.mesh.position.x == sonic.positions.right) return;

	movesonicTo(sonic.positions.right);
}

function slide() {

	if(settings.game.isPaused) return;

	if(sonic.isSliding || sonic.isJumping) return;

	// if already sliding: return
	startSliding();
}

function startSliding() {

	pauseTweens(runningAnimationTweens);

	var dcube =  new THREE.Mesh(boxGeometry, boxCollisionMaterial);
	dcube.name = "playerCollisionBox"
	dcube.scale.set(2, 2, 2);
	dcube.position.set(0, 0, 3);
	dcube.visible = settings.showCollisionBoxes;

	playerCollisionBox = dcube;

	sonic.mesh.add(playerCollisionBox);

	sonic.isSliding = true;
	playSlideAnimation();
	playSlideSound();
}

function endSliding() {

	sonic.isSliding = false;

	sonic.mesh.remove(playerCollisionBox);

	setsonicInitialJoints();
	resumeTweens(runningAnimationTweens);
}

function jump() {

	if(settings.game.isPaused) return;

	if(sonic.isJumping || sonic.isSliding) return;

	// if already jumping: return
	startJumping();
}

function startJumping() {

	pauseTweens(runningAnimationTweens);

	sonic.isJumping = true;
	playJumpAnimation();
	playJumpSound();
	
}

function endJumping() {

	sonic.isJumping = false;

	setsonicInitialJoints();
	resumeTweens(runningAnimationTweens);
}


function addRing() {

	sonic.rings += 1;
	playringSound();

}

function addHealth() {

	sonic.health += 1;
	play1UpSound();

}


function addDamage() {
	
	playDamageAnimation();

	if(sonic.health > 0) {
		sonic.health -= 1;
		playDamageSound();
		playDamageVoiceSound();

	}
	
	if(sonic.health <= 0) {
		updateGUIScores();

		gameOver();
	}
}


function gameOver() {

	document.getElementById("game_over").hidden = false;
	document.getElementById("container").style.backgroundColor = "white";
	document.getElementById("container").style.opacity = "0.7";
	document.getElementById("score").innerHTML = "Your score is: <b>" + sonic.rings + "</b>";

	settings.game.isGameEnded = true;
	settings.game.isPaused = true;

	music.pause();
	playGameOverSound();

	document.onkeydown = function(e) {
	    switch (e.code) {
			case 'Enter':
				window.location.reload();
				break;
		}
	}
}

export function easyMode() {
	console.log("EASY MODE SELECTED");
	settings.game.velocity = 2;
	document.getElementById("easyButton").style.color="white";
	document.getElementById("normalButton").style.color="black";
	document.getElementById("hardButton").style.color="black";
}

export function normalMode() {
	console.log("NORMAL MODE SELECTED");
	settings.game.velocity = 2.5;
	document.getElementById("easyButton").style.color="black";
	document.getElementById("normalButton").style.color="white";
	document.getElementById("hardButton").style.color="black";
}

export function hardMode() {
	console.log("HARD MODE SELECTED");
	settings.game.velocity = 3;
	document.getElementById("easyButton").style.color="black";
	document.getElementById("normalButton").style.color="black";
	document.getElementById("hardButton").style.color="white";
}

export function cityTheme() {
	console.log("CITY THEME SELECTED");
	theme = 0;
	document.getElementById("health").style.color="white";
	document.getElementById("rings").style.color="white";
	document.getElementById("time").style.color="white";
	document.getElementById("game_pause").style.color="white";
	document.getElementById("score").style.color="white";
	document.getElementById("over").style.color="white";

}

export function countrysideTheme() {
	console.log("COUNTRYSIDE THEME SELECTED");
	theme = 1;
	document.getElementById("health").style.color="black";
	document.getElementById("rings").style.color="black";
	document.getElementById("time").style.color="black";
	document.getElementById("pause").style.color="black";

}

export function startGame() {

	document.getElementById("main_menu").hidden = true;
	document.getElementById("container").hidden = false;
	document.getElementById("scores_box").hidden = false;
	

	settings.game.isGameStarted = true;
	settings.game.isPaused = false;

	clock.start();

	camera.position.z = 30; // 10
	camera.position.y = 15; // 8
	camera.updateProjectionMatrix();

	// Outline Effect
	effect = new OutlineEffect( renderer, {
		defaultThickness: 0.0015,
		defaultColor: [ 0, 0, 0 ],
		defaultAlpha: 0.5,
		defaultKeepAlive: true // keeps outline material in cache even if material is removed from scene
	} ); 


	initScene();
	initChunks();
	initSonic();
	initObjects();

	sonic.mesh.rotation.x = degtorad(90);
	sonic.mesh.rotation.z = degtorad(100);

	setsonicInitialJoints();

	animate();
	playRunAnimation();

	playBackgroundMusic();
	playStartVoiceSound();
}

function updateGUIScores() {

	let time = Math.floor(clock.getElapsedTime().toFixed(0) / 60) + ":" + clock.getElapsedTime().toFixed(0) % 60;
	document.getElementById( 'health' ).innerHTML = sonic.health;
	document.getElementById( 'rings' ).innerHTML =  sonic.rings;
	document.getElementById( 'time' ).innerHTML =  time;
}


function checkEggmanCollision() {

	if(eggman.mesh.position.z && ((sonic.mesh.position.z > (parseInt(eggman.mesh.position.z) - 3)) && (sonic.mesh.position.z < (parseInt(eggman.mesh.position.z) + 1)))) {
		if ((sonic.mesh.position.x > (parseInt(eggman.mesh.position.x) - 4)) && (sonic.mesh.position.x < (parseInt(eggman.mesh.position.x) + 4))) {
			if(!isHit) {
				addDamage();
				playEggmanSound();
				isHit = true;
			}
		}
	} else {
		isHit = false;
	}
}


function checkCollisions() {

	activeCollisionBoxes = []
	// Get active collision boxes in scene to be checked
	objects.traverse( function ( child ) {

		if ( child.isMesh ) {
			let collisionBox = child.getObjectByName("collisionBox");
			if (collisionBox) activeCollisionBoxes.push(collisionBox);
		}
	});
	
	activeCollisionBoxes.forEach(checkCollision);

}

// Create ray caster
var rcaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));

function checkCollision(collisionBox) {

	// for each vertex of the playerCollisionBox 
	let verticesIndices = [1, 3, 4, 6, -1] // only vertices from the back of the collision box
	for(var i = 0; i < verticesIndices.length; i++){   

		let origin = new THREE.Vector3();
		let direction = new THREE.Vector3(0, 0, -1);

		if(verticesIndices[i] == -1) {
			// raycast from center of playerCollisionBox
			origin = sonic.mesh.localToWorld(playerCollisionBox.position.clone());
			origin.z += 1;
		}
		else {
			// raycast from vertex of playerCollisionBox
			let vertexLocalPosition = new THREE.Vector3();
			vertexLocalPosition.multiplyVectors( playerCollisionBox.geometry.vertices[ verticesIndices[i] ].clone(), playerCollisionBox.scale );
			vertexLocalPosition.x += playerCollisionBox.position.x;
			vertexLocalPosition.y += playerCollisionBox.position.y;
			vertexLocalPosition.z += playerCollisionBox.position.z;

			origin = sonic.mesh.localToWorld(vertexLocalPosition);
		}

		let rcaster = new THREE.Raycaster(origin, direction.normalize());
			
		// Get collision result
		var hitResult = rcaster.intersectObject(collisionBox);
		if(hitResult.length > 0) {
			handleObjectCollision(collisionBox, hitResult[0].distance);
			break;
		}
	} 
}

function handleObjectCollision(collisionBox, hitDistance) {
	
	if(hits.length > 1) hits.shift();

	// get object name
	let object_name = collisionBox.parent.name;

	// handle collisions based on object type
	switch(object_name){
		case 'ring':
			if( hitDistance <= 3 ) {
				objects.remove(collisionBox.parent);
				addRing();
			}
			break;
		case 'sonic_head':
			if( hitDistance <= 3 ) {
				objects.remove(collisionBox.parent);
				addHealth();
			}
			break;
		case 'trap':
			if ( hitDistance <= 3 ) {
				// console.log("TRAP COLLISION " + hitDistance);
				objects.remove(collisionBox.parent);

				setTimeout(	function() {
					if(hits.includes(Math.trunc(100*hitDistance))) return;
					else{
						addDamage();
						hits.push((Math.trunc(100*hitDistance)));						
					}

				}, 100*Math.random());
			
			}
			break;
		case 'cylinder':
			if ( hitDistance <= 1 ) {
				// console.log("CYLINDER COLLISION " + hitDistance);
				objects.remove(collisionBox.parent);

				setTimeout(	function() {
					if(hits.includes((Math.trunc(100*hitDistance)))) return;
					else {
						addDamage();
						hits.push((Math.trunc(100*hitDistance)));						
					}
				}, 100*Math.random());
			}
			break;
		/*
		case 'eggman':
				if ( hitDistance <= 3 ) {
					// console.log("EGGMAN COLLISION " + hitDistance);
					scene.remove(collisionBox.parent);
					addDamage();
				}
				break;
		*/
	}
}

function setSonicBones() {

	// Traverse model and reference bones of interest
	sonic.mesh.traverse( o => {
		
		if (o.isBone && o.name === 'Shoulder_L_Armature') { 
			sonic.bones.left.clavicle = o;
		}
		if (o.isBone && o.name === 'Shoulder_R_Armature') { 
			sonic.bones.right.clavicle = o;
		} 
		if (o.isBone && o.name === 'UpperArm_L_Armature') { 
			sonic.bones.left.upperarm = o;
		} 
		if (o.isBone && o.name === 'UpperArm_R_Armature') { 
			sonic.bones.right.upperarm = o;
		} 
		if (o.isBone && o.name === 'ForeArm_L_Armature') { 
			sonic.bones.left.forearm = o;
		} 
		if (o.isBone && o.name === 'ForeArm_R_Armature') { 
			sonic.bones.right.forearm = o;
		}
		if (o.isBone && o.name === 'Thigh_L_Armature') { 
			sonic.bones.left.thigh = o;
		} 
		if (o.isBone && o.name === 'Thigh_R_Armature') { 
			sonic.bones.right.thigh = o;
		}
		if (o.isBone && o.name === 'Calf_L_Armature') { 
			sonic.bones.left.knee = o;
		} 
		if (o.isBone && o.name === 'Calf_R_Armature') { 
			sonic.bones.right.knee = o;
		}
		if (o.isBone && o.name === 'Pelvis_L_Armature') { 
			sonic.bones.pelvis = o;
		} 
		if (o.isBone && o.name === 'Pelvis_R_Armature') { 
			sonic.bones.pelvis = o;
		} 
		if (o.isBone && o.name === 'Spine_Armature') { 
			sonic.bones.spine = o;
		} 
		if (o.isBone && o.name === 'Head_Armature') { 
			sonic.bones.head = o;
		}
		if (o.isBone && o.name === 'Eyelid_bones_Armature') { 
			sonic.bones.eyes = o;
		}	

	} );

}


function setEggmanBones() {

	// Traverse model and reference bones of interest
	eggman.mesh.traverse( o => {

		if (o.isBone && o.name === 'n028_object_00004B84_028') { 
			eggman.bones.left.clavicle = o;
		}
		if (o.isBone && o.name === 'n039_object_0000164C_039') { 
			eggman.bones.right.clavicle = o;
		} 
		if (o.isBone && o.name === 'n029_object_00004B50_029') { 
			eggman.bones.left.upperarm = o;
		} 
		if (o.isBone && o.name === 'n040_object_00001618_040') { 
			eggman.bones.right.upperarm = o;
		} 
		if (o.isBone && o.name === 'n030_object_000047E0_030') { 
			eggman.bones.left.forearm = o;
		} 
		if (o.isBone && o.name === 'n041_object_000012C4_041') { 
			eggman.bones.right.forearm = o;
		}
		if (o.isBone && o.name === 'n006_object_000084A4_07') { 
			eggman.bones.left.thigh = o;
		} 
		if (o.isBone && o.name === 'n015_object_0000730C_00') { 
			eggman.bones.right.thigh = o;
		}
		if (o.isBone && o.name === 'n007_object_00008470_08') { 
			eggman.bones.left.knee = o;
		} 
		if (o.isBone && o.name === 'n016_object_000072D8_016') { 
			eggman.bones.right.knee = o;
		}		

	} );

}



function cleanChunks(chunks) {

	for (var i = 0; i < chunks.length; i++) {
		if(sonic.mesh.position.z < chunks[i].position.z - 50){
			// console.log("...REMOVING CHUNKS...");
			for (var j = i; j < i+10; j++) scene.remove(chunks[j]);
	
			chunks.splice(i,10);
		}
	}

}

function generateChunks() {

	var spawn = true;
	var geometry = new THREE.BoxGeometry( 1, 1, 1 );

	// CITY
	if(theme) {
		var texture = new THREE.TextureLoader().load( './assets/images/sand1.jpeg' );
		var material = new THREE.MeshStandardMaterial( { map: texture } );

		var texture_background = new THREE.TextureLoader().load( './assets/images/grass3.jpg' );
		var material_background = new THREE.MeshStandardMaterial( { map: texture_background } );
		
	}
	// COUNTRYSIDE
	else {
		var texture = new THREE.TextureLoader().load( './assets/images/road1.jpeg' );
		var material = new THREE.MeshStandardMaterial( { map: texture } );

		var texture_background = new THREE.TextureLoader().load( './assets/images/sidewalk.jpeg' );
		var material_background = new THREE.MeshStandardMaterial( { map: texture_background } );
	}

	let pos = -180;

	setInterval(function() {
		// MAIN ROAD
		let mesh = new THREE.Mesh( geometry, material );
		mesh.scale.set(30, .1, 30);
		mesh.position.y = -.5;
		mesh.position.z = pos;
		//mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.rotation.x -= Math.PI;


		scene.add(mesh);

		chunks.push(mesh);


		// LEFT CHUNKS
		for(var i = -5; i < 0; i++){
			let mesh = new THREE.Mesh( geometry, material_background );
			//mesh.scale.set(25, 1, 150);
			mesh.scale.set(30, .1, 30);

			mesh.position.x = i * 30 - 0.15;
			mesh.position.y = -.5;
			mesh.position.z = pos;
			//mesh.castShadow = true;
			mesh.receiveShadow = true;
			scene.add(mesh);

			chunks.push(mesh);

		}


		// RIGHT CHUNKS
		for(var i = 1; i < 5; i++){
			let mesh = new THREE.Mesh( geometry, material_background );
			//mesh.scale.set(25, 1, 150);
			mesh.scale.set(30, .1, 30);

			mesh.position.x = i * 30 + 0.15;
			mesh.position.y = -.5;
			mesh.position.z = pos;
			//mesh.castShadow = true;
			mesh.receiveShadow = true;
			scene.add(mesh);
			
			chunks.push(mesh);

		}

		if (spawn) {
			spawn = false;
			if(!theme) {
				var lamp = new THREE.Object3D();
				lamp.name = "lamp";

				let body = models.lamp.gltf.clone();

				lamp.scale.set(80,80,80);								
				
				lamp.add(body);
				
				lamp.position.set(25, 0, pos);
				lamp.castShadow = true;

				scene.add(lamp);

				var lampr = new THREE.Object3D();
				lamp.name = "lampr";

				let bodyr = models.lamp.gltf.clone();

				lampr.scale.set(80,80,80);								
				
				lampr.add(bodyr);
				
				lampr.position.set(-25, 0, pos);
				lampr.castShadow = true;

				scene.add(lampr);
			} 
			else {
				var tree = new THREE.Object3D();
				tree.name = "tree";

				let body = models.tree.gltf.clone();

				tree.scale.set(4,4,4);

				tree.add(body);
				
				tree.position.set(30, 0, pos);
				tree.castShadow = true;

				scene.add(tree);

				var treer = new THREE.Object3D();
				treer.name = "treer";

				let bodyr = models.tree.gltf.clone();

				treer.scale.set(4,4,4);				
				
				treer.add(bodyr);
				
				treer.position.set(-30, 0, pos);
				treer.castShadow = true;

				scene.add(treer);

			}
		} else {
			spawn = true;
			if(theme) {

				var bush = new THREE.Object3D();
				bush.name = "bush";

				let body = models.bush.gltf.clone();

				bush.scale.set(8,8,8);

				bush.add(body);
				
				bush.position.set(30, 0, pos);
				bush.castShadow = true;

				scene.add(bush);

				var bushr = new THREE.Object3D();
				bushr.name = "bushr";

				let bodyr = models.bush.gltf.clone();

				bushr.scale.set(8,8,8);
				
				bushr.add(bodyr);
				
				bushr.position.set(-30, 0, pos);
				bushr.castShadow = true;

				scene.add(bushr);
			}
		}

		pos -= 30;
		
		cleanChunks(chunks);

	}, 700 / settings.game.velocity );

}


function moveSonic() {

	var object_position = -190;
	var object_gap = 150; // gap between object spawn and sonic position
	var spawn_rate = 70; // spawn rate of objects

	var target_position = settings.game.end;
	var position = { z: sonic.mesh.position.z };

	running_tween = new TWEEN.Tween(position)
		.to({ z: target_position }, 30 * (-settings.game.end / settings.game.velocity) )
		.easing(TWEEN.Easing.Linear.None)
		.onUpdate( 
					() => {
						sonic.mesh.position.z = position.z;
						camera.position.z = position.z + 20;
						target_position--;
						checkCollisions();
						checkEggmanCollision();
						cleanObjects();

						if( ((parseInt(sonic.mesh.position.z) - object_gap) < object_position) && parseInt(sonic.mesh.position.z) ) {
							spawnObjects(object_position);
							object_position -= spawn_rate;
						}
					}
		).start();
}

function playRunAnimation() {

	generateChunks(theme);
	setsonicInitialJoints();
	moveSonic();
	
	let step_time = 300; // 200

	// BODY

	// spine rotation
	var spine_max_angle = 50;

	var rotation_spine = { x: 0, y: -spine_max_angle, z: 0 };
	var spine_tween_start_step = new TWEEN.Tween(rotation_spine)
	.to({ x: 0, y: spine_max_angle, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( 
				() => {
					sonic.bones.spine.rotation.y = degtorad( rotation_spine.y );
				}
	).start();

	var rotation_spine_end = { x: 0, y: spine_max_angle, z: 0 };
	var spine_tween_end_step = new TWEEN.Tween(rotation_spine_end)
	.to({ x: 0, y: -spine_max_angle, z: 0 }, step_time) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( 
				() => {
					sonic.bones.spine.rotation.y = degtorad( rotation_spine_end.y );
				}
	).start();
	
	// head rotation
	var head_max_angle = 10;
	//sonic.bones.head.rotation.z = degtorad(-10);

	var rotation_head = { x: 0, y: head_max_angle, z: -10 };
	var head_tween_start_step = new TWEEN.Tween(rotation_head)
	.to({ x: 0, y: -head_max_angle, z: -10 }, step_time) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( 
				() => {
					sonic.bones.head.rotation.y = degtorad( rotation_head.y );
				}
	).start();

	var rotation_head_end = { x: 0, y: -head_max_angle, z: -10 };
	var head_tween_end_step = new TWEEN.Tween(rotation_head_end)
	.to({ x: 0, y: head_max_angle, z: -10 }, step_time) 
	.easing(TWEEN.Easing.Linear.None)
	.onUpdate( 
				() => {
					sonic.bones.head.rotation.y = degtorad( rotation_head_end.y );
				}
	).start();
	
	// LEGS 

	let thigh_max_angle = 60;
	let knee_max_angle = 60;

	// thigh
	sonic.bones.left.thigh.rotation.set(degtorad(-20), degtorad(0), degtorad(0)); 
	sonic.bones.right.thigh.rotation.set(degtorad(20), degtorad(0), degtorad(0)); 
	// knee
	sonic.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	sonic.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(knee_max_angle)); 
	
	var thigh_start = { x: 20, y: 0, z: -thigh_max_angle };
	var thigh_tween_start_step = new TWEEN.Tween(thigh_start)
	.to({ x: 20, y: 0, z: thigh_max_angle }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.bones.left.thigh.rotation.z = degtorad( -thigh_start.z ); // forward
					sonic.bones.right.thigh.rotation.z = degtorad( thigh_start.z ); // backward
				}
	);

	var thigh_end = { x: 20, y: 0, z: -thigh_max_angle };
	var thigh_tween_end_step = new TWEEN.Tween(thigh_end)
	.to({ x: 20, y: 0, z: thigh_max_angle }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.bones.left.thigh.rotation.z = degtorad( thigh_end.z ); // backward
					sonic.bones.right.thigh.rotation.z = degtorad( -thigh_end.z ); // forward
				}
	);

	var knee_start = { x: 0, y: 0, z: 0 };
	var knee_tween_start_step = new TWEEN.Tween(knee_start)
	.to({ x: 0, y: 0, z: knee_max_angle }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.bones.left.knee.rotation.z = degtorad( knee_start.z ); // forward
					sonic.bones.right.knee.rotation.z = degtorad( knee_max_angle - knee_start.z ); // backward
				}
	);

	var knee_end = { x: 0, y: 0, z: 0 };
	var knee_tween_end_step = new TWEEN.Tween(knee_end)
	.to({ x: 0, y: 0, z: knee_max_angle }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.bones.left.knee.rotation.z = degtorad( knee_max_angle - knee_end.z ); // forward
					sonic.bones.right.knee.rotation.z = degtorad( knee_end.z ); // backward
				}
	);

	// ARMS

	// upperarm
	sonic.bones.left.upperarm.rotation.set(degtorad(-90), degtorad(0), degtorad(0));
	sonic.bones.right.upperarm.rotation.set(degtorad(90), degtorad(0), degtorad(0));
	// forearm
	sonic.bones.left.forearm.rotation.set(degtorad(-10), degtorad(0), degtorad(-90));
	sonic.bones.right.forearm.rotation.set(degtorad(10), degtorad(0), degtorad(-90));

	var upperarm_start = { x: 90, y: 0, z: 90 };
	var upperarm_tween_start_step = new TWEEN.Tween(upperarm_start)
	.to({ x: 90, y: 0, z: -90 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.bones.right.upperarm.rotation.z = degtorad( -upperarm_start.z ); // forward
					sonic.bones.left.upperarm.rotation.z = degtorad( upperarm_start.z ); // backward
				}
	);

	var upperarm_end = { x: 90, y: 0, z: 90 };
	var upperarm_tween_end_step = new TWEEN.Tween(upperarm_end)
	.to({ x: 90, y: 0, z: -90 }, step_time) 
	.easing(TWEEN.Easing.Quadratic.Out)
	.onUpdate( 
				() => {
					sonic.bones.right.upperarm.rotation.z = degtorad( upperarm_end.z ); // backward
					sonic.bones.left.upperarm.rotation.z = degtorad( -upperarm_end.z ); // forward
				}
	);

	// START

	thigh_tween_start_step.onComplete( () => { 
		thigh_tween_end_step.start();
		upperarm_tween_start_step.start(); 
	} );
	thigh_tween_end_step.onComplete( () => { thigh_tween_start_step.start(); } );


	head_tween_start_step.onComplete( () => { head_tween_end_step.start(); } );
	head_tween_end_step.onComplete( () => { head_tween_start_step.start(); } );

	spine_tween_start_step.onComplete( () => { spine_tween_end_step.start(); } );
	spine_tween_end_step.onComplete( () => { spine_tween_start_step.start(); } );

	knee_tween_start_step.onComplete( () => { knee_tween_end_step.start(); } );
	knee_tween_end_step.onComplete( () => { knee_tween_start_step.start(); } );

	upperarm_tween_start_step.onComplete( () => { upperarm_tween_end_step.start(); } );
	upperarm_tween_end_step.onComplete( () => { upperarm_tween_start_step.start(); } );
	
	thigh_tween_start_step.start();
	knee_tween_end_step.start();

	runningAnimationTweens.push(spine_tween_start_step);
	runningAnimationTweens.push(spine_tween_end_step);

	runningAnimationTweens.push(head_tween_start_step);
	runningAnimationTweens.push(head_tween_end_step);

	runningAnimationTweens.push(thigh_tween_start_step);
	runningAnimationTweens.push(thigh_tween_end_step);
	
	runningAnimationTweens.push(knee_tween_start_step);
	runningAnimationTweens.push(knee_tween_end_step);

	runningAnimationTweens.push(upperarm_tween_start_step);
	runningAnimationTweens.push(upperarm_tween_end_step);

}

function setsonicInitialJoints() {

	// upperarm
	sonic.bones.left.upperarm.rotation.set(degtorad(-90), degtorad(0), degtorad(0));
	sonic.bones.right.upperarm.rotation.set(degtorad(90), degtorad(0), degtorad(0));
	// forearm
	sonic.bones.left.forearm.rotation.set(degtorad(-10), degtorad(0), degtorad(-90));
	sonic.bones.right.forearm.rotation.set(degtorad(10), degtorad(0), degtorad(-90));
	// thigh
	sonic.bones.left.thigh.rotation.set(degtorad(-15), degtorad(0), degtorad(0));
	sonic.bones.right.thigh.rotation.set(degtorad(15), degtorad(0), degtorad(0));
	// knee
	sonic.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	sonic.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	
	// head
	sonic.bones.head.rotation.z = degtorad(-10);

	// eyes
	sonic.bones.eyes.rotation.z = degtorad(5);


/*
	// initial, static sonic pose

	// clavicle
	sonic.bones.left.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	sonic.bones.right.clavicle.rotation.set(degtorad(0), degtorad(0), degtorad(-85));
	// upperarm
	sonic.bones.left.upperarm.rotation.set(degtorad(0), degtorad(180), degtorad(55));
	sonic.bones.right.upperarm.rotation.set(degtorad(0), degtorad(0), degtorad(55));
	// forearm
	sonic.bones.left.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	sonic.bones.right.forearm.rotation.set(degtorad(0), degtorad(0), degtorad(0));

	// knee
	//sonic.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	//sonic.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	// spine
	sonic.bones.spine.rotation.x = degtorad(-10);
	// head
	sonic.bones.head.rotation.x = degtorad(-5);
	// pelvis
	sonic.bones.pelvis.rotation.x = degtorad(0);
	*/
}

function playJumpAnimation() {

	// upperarm
	sonic.bones.left.upperarm.rotation.set(degtorad(-90), degtorad(70), degtorad(40));
	sonic.bones.right.upperarm.rotation.set(degtorad(90), degtorad(-70), degtorad(40));
	// forearm
	sonic.bones.left.forearm.rotation.set(degtorad(-10), degtorad(0), degtorad(0));
	sonic.bones.right.forearm.rotation.set(degtorad(10), degtorad(0), degtorad(0));
	// thigh
	sonic.bones.left.thigh.rotation.set(degtorad(-15), degtorad(0), degtorad(60));
	sonic.bones.right.thigh.rotation.set(degtorad(15), degtorad(0), degtorad(-60));
	// knee
	sonic.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(60));
	sonic.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(0));
	// head
	//sonic.bones.head.rotation.z = degtorad(20);
	
	// animated movement
	var position = { y: sonic.mesh.position.y }; 

	var tween_start_jumping = new TWEEN.Tween(position)
		.to({ y: sonic.jumpHeigth }, sonic.jumpTime) 
		.easing(TWEEN.Easing.Quadratic.Out)
		.onUpdate( () => { sonic.mesh.position.y = position.y; } );

	var tween_end_jumping = new TWEEN.Tween(position)
		.to({ y: 0 }, sonic.jumpTime) 
		.easing(TWEEN.Easing.Quadratic.In)
		.onUpdate( () => { sonic.mesh.position.y = position.y; } );

	tween_start_jumping.onComplete( () => {
								tween_end_jumping.start();
						      }
	);

	tween_end_jumping.onComplete( () => {
									endJumping();
								}
	);

	tween_start_jumping.start();


}

function playSlideAnimation() {
	
	// upperarm
	sonic.bones.left.upperarm.rotation.set(degtorad(-90), degtorad(70), degtorad(40));
	sonic.bones.right.upperarm.rotation.set(degtorad(90), degtorad(-70), degtorad(40));
	// forearm
	sonic.bones.left.forearm.rotation.set(degtorad(10), degtorad(-20), degtorad(-40));
	sonic.bones.right.forearm.rotation.set(degtorad(-10), degtorad(20), degtorad(-40));
	// thigh
	sonic.bones.left.thigh.rotation.set(degtorad(-20), degtorad(-10), degtorad(-60));
	sonic.bones.right.thigh.rotation.set(degtorad(20), degtorad(10), degtorad(-60));
	// knee
	sonic.bones.left.knee.rotation.set(degtorad(0), degtorad(0), degtorad(50));
	sonic.bones.right.knee.rotation.set(degtorad(0), degtorad(0), degtorad(50));
	// spine
	sonic.bones.spine.rotation.z = degtorad(0);
	// head
	sonic.bones.head.rotation.z = degtorad(0);

	var rotation = { x: sonic.mesh.rotation.x}; 

	playerCollisionBox.position.z += 2;

	var tween_start_sliding = new TWEEN.Tween(rotation)
		.to({ x: degtorad(sonic.slideAngle) }, sonic.slideTime) 
		.easing(TWEEN.Easing.Quadratic.Out)
		.onUpdate( () => { 
							sonic.mesh.rotation.x = rotation.x;
						} );

	var tween_end_sliding = new TWEEN.Tween(rotation)
		.to({ x: degtorad(90)}, sonic.slideTime) 
		.easing(TWEEN.Easing.Quadratic.In)
		.onUpdate( () => { 
							sonic.mesh.rotation.x = rotation.x; 
						} );
	
	tween_start_sliding.onComplete( () => {
		tween_end_sliding.start();
		}
	);

	tween_end_sliding.onComplete( () => {
					endSliding();
				}
	);

	//playerCollisionBox.position.y = 0.5;
	tween_start_sliding.start();
}

function playDamageAnimation() {

	var i=0;
	
	setInterval(function() {
		(i%2)? sonic.mesh.visible = true : sonic.mesh.visible = false;
		if(i < 10) i++;
		else {
			sonic.mesh.visible = true;
			return;
		}
	}, 100);

}


function stopTweens(tweens) {
	tweens.forEach( 
		(tween) => {
			tween.stop();
		} 
	);
}

function pauseTweens(tweens) {
	tweens.forEach( 
		(tween) => {
			tween.pause();
		} 
	);
}

function resumeTweens(tweens) {
	tweens.forEach( 
		(tween) => {
			tween.resume();
		} 
	);	
}

function playBackgroundMusic() {
	
	music.isPlaying = false;
	music.setBuffer( sounds.background.sound );
	music.setLoop( true );
	music.setVolume( 0.3 );
	music.play();

}

function playStartVoiceSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.start_voice.sound );
	sound.setVolume( 0.5 );
	sound.play();
	
}

function playJumpSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.jump.sound );
	sound.setVolume( 0.6 );
	sound.play();
	
}

function playSlideSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.slide.sound );
	sound.setVolume( 0.6 );
	sound.play();

}

function play1UpSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.oneup.sound );
	sound.setVolume( 0.3 );
	sound.play();

}

function playringSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.ring.sound );
	sound.setVolume( 0.1 );
	sound.play();

}

function playDamageSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.damage.sound );
	sound.setVolume( 0.5 );
	sound.play();

}

function playDamageVoiceSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.damage_voice.sound );
	sound.setVolume( 0.5 );
	sound.play();

}


function playEggmanSpawnSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.eggman_voice.sound );
	sound.setVolume( 0.4 );
	sound.play();

}


function playEggmanSound() {
	
	sound.isPlaying = false;
	sound.setBuffer( sounds.eggman.sound );
	sound.setVolume( 0.3 );
	sound.play();

}


function playGameOverSound() {

	sound.isPlaying = false;
	sound.setBuffer( sounds.gameover.sound );
	sound.setVolume( 0.3 );
	sound.play();

}


function animate () {

	requestAnimationFrame( animate );

	if(!settings.game.isGameStarted) TWEEN.update();

	// GAME LOOP
	if (!settings.game.isPaused) { 

		TWEEN.update();

		updateGUIScores();

	}

	effect.render( scene, camera );
};

function toggleGamePause() {
	settings.game.isPaused = !settings.game.isPaused;
	
	// if is paused show pause screen
	document.getElementById("game_pause").hidden = !settings.game.isPaused;
	if(settings.game.isPaused) {
		document.getElementById("container").style.backgroundColor = "white";
		document.getElementById("container").style.opacity = "0.7";
	}
	else {
		document.getElementById("container").style.opacity = "1";	
	}

	if(settings.game.isPaused) {
		music.pause();
		if(ring_rotation_tween)ring_rotation_tween.pause();
		if(head_rotation_tween)head_rotation_tween.pause();
		if(cylinder_rotation_tween)cylinder_rotation_tween.pause();
		running_tween.pause();
	} else {
		music.play();
		if(ring_rotation_tween)ring_rotation_tween.resume();
		if(head_rotation_tween)head_rotation_tween.resume();
		if(cylinder_rotation_tween)cylinder_rotation_tween.resume();
		running_tween.resume();
	}
}


// UTILS

function initEventListeners() {

	initKeyboardListener();
	initWindowListener();
}

function initKeyboardListener() {
	document.onkeydown = function(e) {
	   
	    if(settings.game.isGameStarted & !settings.game.isGameEnded) {
			switch (e.code) {
				case 'KeyA':
				case 'ArrowLeft':
					moveLeft();
					break;
				case 'KeyD':
				case 'ArrowRight':
					moveRight();
					break;
				case 'KeyW':
				case 'ArrowUp':
					jump();
					break;
				case 'KeyS':
				case 'ArrowDown':
					slide();
					break;
				case 'Escape':
					toggleGamePause();
					break;
			}
	    }
	}
}


function initWindowListener() {
	window.addEventListener('resize', () => {
		renderer.setSize(window.innerWidth, window.innerHeight);
		camera.aspect = window.innerWidth/window.innerHeight;
	
		camera.updateProjectionMatrix();
	});
}

function dumpObject(obj, lines = [], isLast = true, prefix = '') {
	const localPrefix = isLast ? '└─' : '├─';
	lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
	const newPrefix = prefix + (isLast ? '  ' : '│ ');
	const lastNdx = obj.children.length - 1;
	obj.children.forEach((child, ndx) => {
		const isLast = ndx === lastNdx;
		dumpObject(child, lines, isLast, newPrefix);
	});
	return lines;
}

function degtorad(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}
