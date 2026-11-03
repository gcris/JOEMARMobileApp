// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PatrolModule",
    platforms: [.iOS(.v13)],
    products: [
        .library(name: "PatrolModule", targets: ["PatrolModule"]),
    ],
    dependencies: [
        .package(url: "https://github.com/expo/expo-modules-core.git", from: "1.0.0"),
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.0.0"),
    ],
    targets: [
        .target(
            name: "PatrolModule",
            dependencies: [
                .product(name: "ExpoModulesCore", package: "expo-modules-core"),
                .product(name: "GRDB", package: "GRDB.swift"),
            ],
            path: "Sources/PatrolModule"
        ),
    ]
)