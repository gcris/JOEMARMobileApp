Pod::Spec.new do |s|
  s.name           = 'PatrolModule'
  s.version        = '1.0.0'
  s.summary        = 'Patrol tracking native module for iOS'
  s.description    = 'Native iOS module for background GPS tracking, SQLite persistence, and Supabase sync'
  s.author         = 'INPPO'
  s.homepage       = 'https://github.com/inppo/patrol-module'
  s.license        = { :type => 'MIT', :file => 'LICENSE' }
  s.platform       = :ios, '13.0'
  s.swift_version  = '5.7'
  s.source         = { :git => '' }
  s.static_framework = true

  s.source_files   = 'Sources/PatrolModule/**/*.{swift,h,m,mm}'
  s.module_name    = 'PatrolModule'

  s.dependency 'ExpoModulesCore'
  s.dependency 'GRDB.swift', '~> 6.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  s.user_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '"${PODS_ROOT}/../../ios/PatrolModule/Sources/PatrolModule"',
  }
end