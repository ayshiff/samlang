plugins {
    kotlin(module = "jvm")
}

dependencies {
    implementation(project(":samlang-ast"))
    implementation(project(":samlang-analysis"))
    implementation(project(":samlang-optimization"))
}
