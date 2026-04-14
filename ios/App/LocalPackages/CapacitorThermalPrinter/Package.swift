// swift-tools-version: 5.9
// Vendored desde node_modules (ver scripts/setup-ios-thermal-printer.mjs). iOS usa BLE (RTPrinter SDK).
import PackageDescription

let package = Package(
    name: "CapacitorThermalPrinter",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CapacitorThermalPrinter", targets: ["CapacitorThermalPrinter"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.1")
    ],
    targets: [
        .target(
            name: "CapacitorThermalPrinter",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "Vendor",
            exclude: [
                "SDK/libRTPrinterSDK.a",
                "Info.plist"
            ],
            resources: [
                .copy("SDK/Resource/ble_serial.plist")
            ],
            cSettings: [
                .headerSearchPath("SDK/include/RTPrinterSDK")
            ],
            swiftSettings: [
                .unsafeFlags(
                    [
                        "-import-objc-header",
                        "CapacitorThermalPrinter-Bridging-Header.h"
                    ],
                    .when(platforms: [.iOS])
                )
            ],
            linkerSettings: [
                .linkedLibrary("z"),
                .linkedFramework("CoreBluetooth"),
                .unsafeFlags(
                    [
                        "-L./Vendor/SDK",
                        "-lRTPrinterSDK",
                        "-ObjC"
                    ],
                    .when(platforms: [.iOS])
                )
            ]
        )
    ]
)
